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
  const refused = await call("/api/sessions", {
    body: { name: "No consent", displayName: "Ada", purpose: "community", consent: false },
  });
  note("community consent required", refused.status === 400, `HTTP ${refused.status}`);

  const created = await call("/api/sessions", {
    body: {
      name: "Community journey",
      displayName: "Ada",
      purpose: "community",
      communityRole: "facilitator",
      consent: true,
      description: "Isolated community journey",
    },
  });
  const code = created.data?.code;
  const tokenA = created.data?.token;
  note("create community session", created.status === 201 && created.data?.purpose === "community" && created.data?.communityRole === "facilitator" && created.data?.role === "A", `HTTP ${created.status}`);

  const joined = await call("/api/sessions/join", { body: { code, displayName: "Bao", role: "B" } });
  const tokenB = joined.data?.token;
  note("join participant", joined.status === 200 && joined.data?.role === "B", `HTTP ${joined.status}`);

  const task = await call(`/api/sessions/${code}/community`, {
    token: tokenA,
    body: { action: "create-task", templateId: "everyday-item" },
  });
  note("open a situation", task.ok && Boolean(task.data?.taskId), `HTTP ${task.status}`);
  const taskId = task.data?.taskId;

  await call(`/api/sessions/${code}/community`, { token: tokenA, body: { action: "show", taskId, note: "Shows a cup." } });
  const savedA = await call(`/api/sessions/${code}/community`, {
    token: tokenA,
    body: { action: "respond", taskId, kind: "interpretation", body: "water" },
  });
  note("facilitator saves a private response", savedA.ok, `HTTP ${savedA.status} ${savedA.data?.error ?? ""}`);
  await call(`/api/sessions/${code}/community`, { token: tokenA, body: { action: "lock", taskId } });

  const earlyB = await call(`/api/sessions/${code}`, { token: tokenB });
  const hidden = (earlyB.data?.responses ?? []).find((item) => item.authorParticipantId !== earlyB.data?.viewer?.id);
  note("other person cannot read the draft", Boolean(hidden) && hidden.hidden === true && hidden.body === "", hidden ? `hidden=${hidden.hidden}` : "missing");

  await call(`/api/sessions/${code}/community`, {
    token: tokenB,
    body: { action: "respond", taskId, kind: "drawing", body: "10,10 40,20" },
  });
  await call(`/api/sessions/${code}/community`, { token: tokenB, body: { action: "lock", taskId } });
  const compared = await call(`/api/sessions/${code}`, { token: tokenA });
  const visible = (compared.data?.responses ?? []).filter((item) => item.taskId === taskId && !item.hidden);
  note("comparison opens after both locks", visible.length === 2 && compared.data?.tasks?.[0]?.step === "compare", `visible=${visible.length} step=${compared.data?.tasks?.[0]?.step}`);

  const ambiguity = await call(`/api/sessions/${code}/community`, {
    token: tokenB,
    body: { action: "ambiguity", taskId, note: "The object and the action are both possible." },
  });
  note("record ambiguity", ambiguity.ok, `HTTP ${ambiguity.status}`);

  const proposal = await call(`/api/sessions/${code}/community`, {
    token: tokenA,
    body: { action: "propose", taskId, interpretations: ["water", "drinking", "container"] },
  });
  note("suggest a discriminating check", proposal.ok && Boolean(proposal.data?.proposalId), `HTTP ${proposal.status} source=${proposal.data?.source}`);

  const blocked = await call(`/api/sessions/${code}/community`, {
    token: tokenB,
    body: { action: "approve", proposalId: proposal.data.proposalId },
  });
  note("participant cannot approve", blocked.status === 403, `HTTP ${blocked.status}`);

  const form = new FormData();
  form.set("type", "image");
  form.set("description", "A glass of water.");
  form.set("notes", "Shown during the community journey.");
  form.set("stance", "observation");
  form.set("file", png(), "glass.png");
  const image = await call(`/api/sessions/${code}/evidence`, { token: tokenA, form });
  const analysis = await call(`/api/sessions/${code}/analyze`, { token: tokenA, body: { evidenceId: image.data?.evidenceId } });
  const accepted = await call(`/api/sessions/${code}/hypotheses/${analysis.data?.hypothesisIds?.[0]}`, {
    token: tokenA,
    body: { action: "accept", category: "water", meaning: "Water, the substance" },
  });
  note("accept stays unverified", accepted.ok && accepted.data?.status !== "verified", `status=${accepted.data?.status}`);

  const approved = await call(`/api/sessions/${code}/community`, {
    token: tokenA,
    body: { action: "approve", proposalId: proposal.data.proposalId, conceptId: accepted.data?.conceptId },
  });
  const afterApproval = await call(`/api/sessions/${code}`, { token: tokenA });
  const concept = (afterApproval.data?.concepts ?? []).find((item) => item.id === accepted.data?.conceptId);
  note("approval does not verify", approved.ok && Boolean(approved.data?.experimentId) && concept?.status !== "verified", `status=${concept?.status}`);

  await call(`/api/sessions/${code}/experiments/${approved.data.experimentId}/respond`, {
    token: tokenB,
    body: { result: "correct", selectedOptionId: accepted.data.conceptId, notes: "Matches the liquid." },
  });
  const second = await call(`/api/sessions/${code}/experiments`, {
    token: tokenA,
    body: { conceptId: accepted.data.conceptId, type: "repeated_verification", stimulusNote: "a different cup, not the first glass" },
  });
  const verified = await call(`/api/sessions/${code}/experiments/${second.data?.experimentId}/respond`, {
    token: tokenA,
    body: { result: "correct", selectedOptionId: accepted.data.conceptId, notes: "Matches the second example." },
  });
  note("session-verified after two methods", verified.data?.status === "verified", verified.data?.status ?? verified.data?.error);

  const same = await call(`/api/sessions/${code}/experiments`, {
    token: tokenA,
    body: { conceptId: accepted.data.conceptId, type: "repeated_verification", stimulusNote: "a different cup, not the first glass" },
  });
  note("identical stimulus is rejected", same.status === 409, `HTTP ${same.status}`);

  await call(`/api/sessions/${code}/concepts/${accepted.data.conceptId}`, {
    method: "PATCH",
    token: tokenB,
    body: { action: "dispute" },
  });
  const disputed = await call(`/api/sessions/${code}`, { token: tokenA });
  note("disagreement recorded", (disputed.data?.concepts ?? []).find((item) => item.id === accepted.data.conceptId)?.status === "disputed", "status");

  const expression = await call(`/api/sessions/${code}/expressions`, {
    token: tokenA,
    body: {
      title: "Shared board",
      conceptIds: [accepted.data.conceptId],
      orderNote: "The order on the board is a hypothesis. It is not a grammar and it is not a translation.",
    },
  });
  const shown = await call(`/api/sessions/${code}/expressions/${expression.data?.expressionId}`, {
    method: "PATCH",
    token: tokenB,
    body: { shown: true, comprehension: "clarification" },
  });
  note("board expression and clarification", expression.ok && shown.ok, `HTTP ${shown.status}`);

  const outcome = await call(`/api/sessions/${code}/community`, {
    token: tokenA,
    body: { action: "outcome", taskId, outcome: "another-round", note: "The readings still compete." },
  });
  note("record another round", outcome.ok, `HTTP ${outcome.status}`);

  const impact = await call(`/api/sessions/${code}/impact`, { token: tokenA });
  const report = await call(`/api/sessions/${code}/impact?format=md`, { token: tokenA });
  note(
    "impact uses this session",
    impact.ok && impact.data?.sample === false && impact.data?.tasksAttempted >= 1 && impact.data?.repeatedAttempts >= 1 && String(report.text).includes("does not") && String(report.text).includes(code) && !String(report.text).includes(tokenA),
    `tasks=${impact.data?.tasksAttempted} repeated=${impact.data?.repeatedAttempts}`,
  );

  const reloaded = await call(`/api/sessions/${code}`, { token: tokenB });
  note("persists after reload", (reloaded.data?.responses ?? []).length >= 2 && (reloaded.data?.expressions ?? []).some((item) => item.comprehension === "clarification"), `responses=${reloaded.data?.responses?.length}`);

  const shoreBefore = await call("/api/sessions/SHORE-1001");
  const removed = await call(`/api/sessions/${code}`, { method: "DELETE", token: tokenA, body: { confirmCode: code } });
  const shoreAfter = await call("/api/sessions/SHORE-1001");
  const shoreCount = Number(execFileSync("sqlite3", ["data/first-contact.db", "SELECT COUNT(*) FROM Concept WHERE sessionId = (SELECT id FROM DiscoverySession WHERE code = 'SHORE-1001');"], { encoding: "utf8" }).trim());
  note("delete only the journey session", removed.ok && shoreBefore.status === 404 && shoreAfter.status === 404 && shoreCount === 8, `shore=${shoreCount}`);

  if (failures.length) {
    console.error(`\n${failures.length} community journey failure(s).`);
    process.exit(1);
  }
  console.log("\nCommunity journey passed. Tokens were not printed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
