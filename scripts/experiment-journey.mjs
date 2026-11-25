import { execFileSync } from "node:child_process";

const base = process.env.SMOKE_BASE ?? "http://127.0.0.1:3010";
const failures = [];

function note(step, ok, detail) {
  const line = `${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`;
  console.log(line);
  if (!ok) failures.push(line);
}

async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? (options.body || options.form ? "POST" : "GET"),
    headers: {
      ...(options.token ? { "x-participant-token": options.token } : {}),
      ...(options.form ? {} : options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.form ?? (options.body ? JSON.stringify(options.body) : undefined),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, ok: response.ok, data, text };
}

function png() {
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  return new Blob([bytes], { type: "image/png" });
}

async function main() {
  const created = await call("/api/sessions", {
    body: { name: "Experiment journey", displayName: "Ada", purpose: "community", communityRole: "facilitator", consent: true },
  });
  const code = created.data?.code;
  const tokenA = created.data?.token;
  note("create community session", created.status === 201 && Boolean(code), `HTTP ${created.status}`);

  const joined = await call("/api/sessions/join", { body: { code, displayName: "Bao", role: "B" } });
  const tokenB = joined.data?.token;
  note("join participant", joined.status === 200, `HTTP ${joined.status}`);

  const image = new FormData();
  image.set("type", "image");
  image.set("description", "A person points at a glass and mimes drinking.");
  image.set("notes", "The glass may be water, the container, or the act of drinking.");
  image.set("actionCategory", "drinking");
  image.set("file", png(), "glass.png");
  const evidence = await call(`/api/sessions/${code}/evidence`, { token: tokenA, form: image });
  note("share an image", evidence.status === 201, `HTTP ${evidence.status}`);

  const gesture = new FormData();
  gesture.set("type", "gesture");
  gesture.set("description", "Hand lifts an empty cup toward the mouth.");
  gesture.set("actionCategory", "drinking");
  gesture.set("gestureDirection", "up");
  gesture.set("gestureBody", "hand");
  const gestured = await call(`/api/sessions/${code}/evidence`, { token: tokenA, form: gesture });
  note("share a gesture", gestured.status === 201, `HTTP ${gestured.status}`);

  const analyzed = await call(`/api/sessions/${code}/analyze`, { token: tokenA, body: { evidenceId: evidence.data.evidenceId } });
  note("competing hypotheses", analyzed.ok && (analyzed.data?.hypothesisIds?.length ?? 0) >= 2, `HTTP ${analyzed.status} count=${analyzed.data?.hypothesisIds?.length}`);

  const planned = await call(`/api/sessions/${code}/plans`, { token: tokenA, body: { action: "request" } });
  note("experiment suggestion", planned.ok && planned.data?.sufficient === true && planned.data?.simulated === true, `HTTP ${planned.status} source=${planned.data?.source}`);

  const hidden = await call(`/api/sessions/${code}`, { token: tokenB });
  const hiddenText = JSON.stringify(hidden.data?.proposals ?? []) + JSON.stringify(hidden.data?.hypotheses ?? []);
  note("participant hypotheses stay off the response", (hidden.data?.hypotheses ?? []).length === 0, `count=${hidden.data?.hypotheses?.length}`);
  note("participant cannot see outcome mappings", !hiddenText.includes("stays possible") && (hidden.data?.proposals ?? []).every((item) => (item.outcomes ?? []).length === 0 && (item.planOutcomes ?? []).length === 0), hiddenText.includes("stays possible") ? "mapping leaked" : "hidden");

  const proposalId = planned.data?.proposalIds?.[0];
  const blocked = await call(`/api/sessions/${code}/plans`, { token: tokenB, body: { action: "approve", proposalId } });
  note("participant cannot approve", blocked.status === 403, `HTTP ${blocked.status}`);

  const approved = await call(`/api/sessions/${code}/plans`, { token: tokenA, body: { action: "approve", proposalId } });
  note("facilitator approves", approved.ok, `HTTP ${approved.status}`);

  const participantView = await call(`/api/sessions/${code}`, { token: tokenB });
  const visible = (participantView.data?.proposals ?? []).find((item) => item.id === proposalId);
  note("neutral prompt only", Boolean(visible?.prompt) && (visible?.planOutcomes ?? []).length === 0 && !visible.prompt.toLowerCase().includes("stays possible"), visible?.prompt ? "prompt" : "missing");

  const replyB = await call(`/api/sessions/${code}/plans`, {
    token: tokenB,
    body: { action: "reply", proposalId, body: "The empty container does not match.", stance: "differs" },
  });
  const lockB = await call(`/api/sessions/${code}/plans`, { token: tokenB, body: { action: "lock", proposalId } });
  note("participant locks a private response", replyB.ok && lockB.ok, `reply=${replyB.status} lock=${lockB.status}`);

  const beforeA = await call(`/api/sessions/${code}`, { token: tokenA });
  const draft = (beforeA.data?.proposals ?? []).find((item) => item.id === proposalId)?.replies?.find((item) => item.participantId !== beforeA.data?.viewer?.id);
  note("facilitator cannot read the unlocked draft", draft?.hidden === true && draft.body === "", draft ? `hidden=${draft.hidden}` : "missing");

  await call(`/api/sessions/${code}/plans`, { token: tokenA, body: { action: "reply", proposalId, body: "The liquid matches.", stance: "matches" } });
  await call(`/api/sessions/${code}/plans`, { token: tokenA, body: { action: "lock", proposalId } });
  const compared = await call(`/api/sessions/${code}`, { token: tokenA });
  const open = (compared.data?.proposals ?? []).find((item) => item.id === proposalId);
  note("both locked responses are visible", (open?.replies ?? []).filter((item) => !item.hidden).length === 2, `visible=${open?.replies?.length}`);

  const outcome = open?.planOutcomes?.[2]?.outcome;
  const recorded = await call(`/api/sessions/${code}/plans`, { token: tokenA, body: { action: "record", proposalId, outcome } });
  const reviewed = await call(`/api/sessions/${code}`, { token: tokenA });
  const review = (reviewed.data?.proposals ?? []).find((item) => item.id === proposalId)?.review;
  note("outcome stays unverified", recorded.ok && review?.verified === false && (reviewed.data?.concepts ?? []).every((item) => item.status !== "verified"), `HTTP ${recorded.status}`);

  const follow = await call(`/api/sessions/${code}/plans`, { token: tokenA, body: { action: "request", followUp: true } });
  const firstStimuli = JSON.stringify(open?.stimuli ?? []);
  const nextView = await call(`/api/sessions/${code}`, { token: tokenA });
  const next = (nextView.data?.proposals ?? []).find((item) => item.status === "proposed");
  note("follow-up uses a different stimulus", follow.ok && next && JSON.stringify(next.stimuli) !== firstStimuli, next?.title ?? `HTTP ${follow.status}`);

  const timeline = (nextView.data?.events ?? []).map((item) => item.type);
  note("timeline events persisted", timeline.includes("plan.created") && timeline.includes("plan.approved") && timeline.includes("plan.locked"), timeline.filter((item) => item.startsWith("plan")).join(","));

  const again = await call(`/api/sessions/${code}`, { token: tokenB });
  note("reload keeps the neutral prompt", (again.data?.proposals ?? []).some((item) => item.prompt) && (again.data?.hypotheses ?? []).length === 0, "reloaded");

  const removed = await call(`/api/sessions/${code}`, { method: "DELETE", token: tokenA, body: { confirmCode: code } });
  const shore = await call("/api/sessions/SHORE-1001");
  const shoreCount = Number(execFileSync("sqlite3", ["data/first-contact.db", "SELECT COUNT(*) FROM Concept WHERE sessionId = (SELECT id FROM DiscoverySession WHERE code = 'SHORE-1001');"], { encoding: "utf8" }).trim());
  note("delete only the journey session", removed.ok && shore.status === 404 && shoreCount === 8, `shore=${shoreCount}`);

  if (failures.length) {
    console.error(`${failures.length} experiment journey check(s) failed.`);
    process.exit(1);
  }
  console.log("Experiment journey passed. Tokens were not printed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.name : "Experiment journey failed.");
  process.exit(1);
});
