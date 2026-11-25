import { execFileSync } from "node:child_process";

const base = process.env.SMOKE_BASE ?? "http://127.0.0.1:3010";
const failures = [];
const secret = "HIDDEN-HYPOTHESIS-PHASE81";

function note(step, ok, detail) {
  const line = `${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`;
  console.log(line);
  if (!ok) failures.push(line);
}

async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      ...(options.token ? { "x-participant-token": options.token } : {}),
      ...(options.headers ?? {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, ok: response.ok, data, text };
}

function counts() {
  const concepts = execFileSync("sqlite3", ["data/first-contact.db", "SELECT COUNT(*) FROM Concept WHERE sessionId = (SELECT id FROM DiscoverySession WHERE code = 'SHORE-1001');"], { encoding: "utf8" }).trim();
  const evidence = execFileSync("sqlite3", ["data/first-contact.db", "SELECT COUNT(*) FROM Evidence WHERE sessionId = (SELECT id FROM DiscoverySession WHERE code = 'SHORE-1001') AND deletedAt IS NULL;"], { encoding: "utf8" }).trim();
  return `${concepts}|${evidence}`;
}

const before = counts();
const reset = await call("/api/demo/reset", { method: "POST", body: {} });
const entered = await call("/api/demo/enter", { body: { role: "A" } });
const both = await call("/api/demo/enter", { body: { role: "B" } });
const afterDenied = counts();
note("demo reset denied", reset.status === 403 && afterDenied === before && !reset.text.includes("demo-shore"), `HTTP ${reset.status}`);
note("demo enter denied", entered.status === 403 && both.status === 403 && !entered.text.includes("token") && !both.text.includes("demo-shore") && afterDenied === before, `HTTP ${entered.status}`);

const unknown = await call("/api/sessions/TREE-0000");
const known = await call("/api/sessions/SHORE-1001");
const joinUnknown = await call("/api/sessions/join", { body: { code: "TREE-0000", displayName: "No One", role: "B" } });
note("unknown and known codes match", unknown.status === 404 && known.status === 404 && unknown.text === known.text && joinUnknown.status === 404 && joinUnknown.text === known.text && !known.text.includes("Water"), `HTTP ${known.status}`);

let code = "";
let tokenA = "";
let tokenB = "";
let otherCode = "";
let otherToken = "";
try {
  const created = await call("/api/sessions", { body: { name: "Hardening", displayName: "Ada", role: "A", purpose: "community", communityRole: "facilitator", consent: true } });
  code = created.data?.code;
  tokenA = created.data?.token;
  const joined = await call("/api/sessions/join", { body: { code, displayName: "Bao", role: "B" } });
  tokenB = joined.data?.token;
  const other = await call("/api/sessions", { body: { name: "Hardening other", displayName: "Cam", role: "A", purpose: "general" } });
  otherCode = other.data?.code;
  otherToken = other.data?.token;
  note("sessions created", created.status === 201 && joined.ok && other.status === 201 && tokenA !== tokenB, `HTTP ${created.status}`);

  const hypothesis = await call(`/api/sessions/${code}/hypotheses`, {
    token: tokenA,
    body: { proposedMeaning: secret, explanation: "Hidden.", alternatives: "Another reading" },
  });
  const hypothesisId = hypothesis.data?.hypothesisId;
  const acceptB = await call(`/api/sessions/${code}/hypotheses/${hypothesisId}`, { token: tokenB, body: { action: "accept", category: "objects", meaning: secret } });
  const rejectB = await call(`/api/sessions/${code}/hypotheses/${hypothesisId}`, { token: tokenB, body: { action: "reject", note: "" } });
  const challengeB = await call(`/api/sessions/${code}/hypotheses/${hypothesisId}`, { token: tokenB, body: { action: "challenge", note: "" } });
  const patchB = await call(`/api/sessions/${code}/hypotheses/${hypothesisId}`, { method: "PATCH", token: tokenB, body: { action: "accept" } });
  const deleteB = await call(`/api/sessions/${code}/hypotheses/${hypothesisId}`, { method: "DELETE", token: tokenB });
  const cross = await call(`/api/sessions/${otherCode}/hypotheses/${hypothesisId}`, { token: otherToken, body: { action: "accept", category: "objects", meaning: secret } });
  const after = await call(`/api/sessions/${code}`, { token: tokenA });
  const stillOpen = (after.data?.hypotheses ?? []).some((item) => item.id === hypothesisId && item.status === "open");
  note("participant cannot mutate a hypothesis", acceptB.status === 403 && rejectB.status === 403 && challengeB.status === 403 && !acceptB.text.includes(secret) && stillOpen, `HTTP ${acceptB.status}`);
  note("missing mutation methods stay closed", [404, 405].includes(patchB.status) && [404, 405].includes(deleteB.status) && !patchB.text.includes(secret) && !deleteB.text.includes(secret), `HTTP ${patchB.status}/${deleteB.status}`);
  note("cross-session hypothesis id is opaque", cross.status === 404 && !cross.text.includes(secret) && stillOpen, `HTTP ${cross.status}`);

  const accepted = await call(`/api/sessions/${code}/hypotheses/${hypothesisId}`, { token: tokenA, body: { action: "accept", category: "objects", meaning: "A cup" } });
  note("facilitator can accept", accepted.ok && accepted.data?.status !== "verified", accepted.data?.status ?? `HTTP ${accepted.status}`);

  const conceptId = accepted.data?.conceptId;
  await call(`/api/sessions/${code}/concepts/${conceptId}`, { method: "PATCH", token: tokenA, body: { exampleSituations: "A cup on the table." } });
  const activities = await call(`/api/sessions/${code}/activities`, { token: tokenA, body: { type: "match_example" } });
  const activityId = activities.data?.activityIds?.[0];
  const answered = await call(`/api/sessions/${code}/activities/${activityId}/respond`, { token: tokenB, body: { selectedOptionId: conceptId, notes: "Bao practices." } });
  const asB = await call(`/api/sessions/${code}`, { token: tokenB });
  const asA = await call(`/api/sessions/${code}`, { token: tokenA });
  const activityB = (asB.data?.activities ?? []).find((item) => item.id === activityId);
  const activityA = (asA.data?.activities ?? []).find((item) => item.id === activityId);
  const foreign = (activityA?.responses ?? []).filter((item) => item.participantId !== asA.data?.viewer?.id);
  note("practice is solo", activities.ok && answered.ok && activityB?.practiceMode === "solo" && activityB?.answerKey === "" && activityB?.responses?.length === 1 && typeof activityB.responses[0].correct === "boolean", `mode=${activityB?.practiceMode} key=${activityB?.answerKey ?? "missing"}`);
  note("other participant does not receive the answer key", activityB?.answerKey === "" && !JSON.stringify(asB.data?.events ?? []).includes("\"correct\":true") || (asB.data?.events ?? []).filter((item) => item.type === "activity.answered").every((item) => item.participantId === asB.data?.viewer?.id || Object.keys(item.payload ?? {}).length === 0), "hidden");

  const rejoined = await call("/api/sessions/rejoin", { body: { code, token: tokenB } });
  const stale = await call(`/api/sessions/${code}`, { token: tokenB });
  const current = await call(`/api/sessions/${code}`, { token: rejoined.data?.token });
  note("rejoin replaces the recovery key", rejoined.ok && rejoined.data?.token && rejoined.data.token !== tokenB && stale.status === 401 && current.ok, `HTTP ${stale.status}`);
  tokenB = rejoined.data?.token;

  const left = await call(`/api/sessions/${code}/leave`, { token: tokenB, body: {} });
  const blocked = await call(`/api/sessions/${code}`, { token: tokenB });
  note("leave revokes the key", left.ok && blocked.status === 403 && !blocked.text.includes(secret), `HTTP ${blocked.status}`);
} finally {
  if (code && tokenA) await call(`/api/sessions/${code}`, { method: "DELETE", token: tokenA, body: { confirmCode: code } });
  if (otherCode && otherToken) await call(`/api/sessions/${otherCode}`, { method: "DELETE", token: otherToken, body: { confirmCode: otherCode } });
}

const remaining = execFileSync("sqlite3", ["data/first-contact.db", "SELECT code FROM DiscoverySession;"], { encoding: "utf8" }).trim();
note("illustrative session unchanged", counts() === before && remaining === "SHORE-1001", remaining);
if (failures.length) {
  console.error(`${failures.length} security check(s) failed.`);
  process.exit(1);
}
console.log("Security hardening checks passed. Tokens were not printed.");
