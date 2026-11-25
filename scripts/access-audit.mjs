import { execFileSync } from "node:child_process";

const base = process.env.SMOKE_BASE ?? "http://127.0.0.1:3010";
const failures = [];
const secret = "SECRET-READING-PHASE8";
const noteText = "FACILITATOR-NOTE-PHASE8";

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
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, ok: response.ok, data, text };
}

function leaked(text) {
  return text.includes(secret) || text.includes(noteText);
}

const listed = await call("/api/sessions");
note("unauthenticated session list", listed.status === 401 && !listed.text.includes("SHORE-1001"), `HTTP ${listed.status}`);

const guessed = await call("/api/sessions/TREE-0000");
note("guessed session code", guessed.status === 404 && !leaked(guessed.text), `HTTP ${guessed.status}`);

const shore = await call("/api/sessions/SHORE-1001");
note("demo code is not a read credential", shore.status === 404 && shore.text === guessed.text && !shore.text.includes("Water"), `HTTP ${shore.status}`);

const created = await call("/api/sessions", {
  body: { name: "Access audit", displayName: "Ada", purpose: "community", communityRole: "facilitator", consent: true },
});
const code = created.data?.code;
let tokenA = created.data?.token;
const joined = await call("/api/sessions/join", { body: { code, displayName: "Bao", role: "B" } });
const tokenB = joined.data?.token;
const other = await call("/api/sessions", { body: { name: "Other access", displayName: "Cam", purpose: "general", consent: true } });

try {
  const bare = await call(`/api/sessions/${code}`);
  note("code without a seat", bare.status === 404 && bare.text === guessed.text && !leaked(bare.text), `HTTP ${bare.status}`);

  const cross = await call(`/api/sessions/${code}`, { token: other.data?.token });
  note("token from another session", cross.status === 404 && cross.text === guessed.text && !leaked(cross.text), `HTTP ${cross.status}`);

  const badToken = await call(`/api/sessions/${code}`, { token: "not-a-real-token" });
  note("invalid token", badToken.status === 404 && badToken.text === guessed.text && !badToken.text.includes(code), `HTTP ${badToken.status}`);

  await call(`/api/sessions/${code}/notes`, { token: tokenA, body: { title: "Private", body: noteText } });
  await call(`/api/sessions/${code}/hypotheses`, { token: tokenA, body: { proposedMeaning: secret, explanation: "Hidden from Bao.", alternatives: "Another reading" } });

  const asB = await call(`/api/sessions/${code}`, { token: tokenB });
  note("participant session hides the plan", asB.ok && asB.data?.hypotheses?.length === 0 && !leaked(asB.text), `hypotheses=${asB.data?.hypotheses?.length}`);

  const synced = await call(`/api/sessions/${code}/sync?revision=0`, { token: tokenB });
  note("participant sync hides the plan", synced.ok && !leaked(synced.text), `HTTP ${synced.status}`);

  const formats = [
    `/api/research/export?format=json&code=${code}`,
    `/api/research/export?format=csv&dataset=hypotheses&code=${code}`,
    `/api/research/export?format=csv&dataset=evidence&code=${code}`,
    `/api/research/export?format=csv&dataset=checks&code=${code}`,
    `/api/research/export?format=csv&dataset=concepts&code=${code}`,
    `/api/research/export?format=csv&dataset=relationships&code=${code}`,
    `/api/research/export?format=md&code=${code}`,
    `/api/research?code=${code}`,
  ];
  for (const path of formats) {
    const open = await call(path);
    const participant = await call(path, { token: tokenB });
    const host = await call(path, { token: tokenA });
    note(`export denied without a seat ${path.split("?")[0]} ${path.includes("dataset=") ? path.split("dataset=")[1].split("&")[0] : path.includes("format=") ? path.split("format=")[1].split("&")[0] : "snapshot"}`, open.status === 404 && !leaked(open.text), `HTTP ${open.status}`);
    note(`participant export denied`, participant.status === 403 && !leaked(participant.text), `HTTP ${participant.status}`);
    const expectsSecret = path.includes("format=json") || path.includes("/api/research?") || path.includes("dataset=hypotheses");
    const expectsNote = path.includes("format=md") || path.includes("format=json");
    note(`facilitator export allowed`, host.ok && (!expectsSecret || host.text.includes(secret)) && (!expectsNote || host.text.includes(noteText)) && !host.text.includes(tokenA), `HTTP ${host.status}`);
  }
  const missingCode = await call("/api/research/export?format=json", { token: tokenA });
  note("export without a session code", missingCode.status === 400, `HTTP ${missingCode.status}`);

  const ownList = await call("/api/sessions", { token: tokenA });
  note("seat lists only its session", ownList.ok && ownList.data?.sessions?.length === 1 && ownList.data.sessions[0].code === code && !ownList.text.includes("SHORE-1001"), `count=${ownList.data?.sessions?.length}`);

  await call(`/api/sessions/${code}/leave`, { token: tokenA, body: {} });
  const left = await call(`/api/sessions/${code}`, { token: tokenA });
  note("left seat cannot read", left.status === 403 && !leaked(left.text), `HTTP ${left.status}`);
  const rejoined = await call("/api/sessions/rejoin", { body: { code, token: tokenA } });
  tokenA = rejoined.data?.token || tokenA;
  const back = await call(`/api/sessions/${code}`, { token: tokenA });
  note("rejoin restores the seat", rejoined.ok && Boolean(rejoined.data?.token) && back.ok && back.data?.hypotheses?.some((item) => item.proposedMeaning === secret), `HTTP ${rejoined.status}`);

  const hypothesis = back.data.hypotheses[0];
  const accepted = await call(`/api/sessions/${code}/hypotheses/${hypothesis.id}`, {
    token: tokenA,
    body: { action: "accept", category: "objects", meaning: "A cup" },
  });
  const first = await call(`/api/sessions/${code}/experiments`, {
    token: tokenA,
    body: { conceptId: accepted.data.conceptId, type: "contrast_testing", stimulusNote: "cup on the table" },
  });
  await call(`/api/sessions/${code}/experiments/${first.data.experimentId}/respond`, {
    token: tokenA,
    body: { result: "correct", notes: "Ada only." },
  });
  const second = await call(`/api/sessions/${code}/experiments`, {
    token: tokenA,
    body: { conceptId: accepted.data.conceptId, type: "repeated_verification", stimulusNote: "a different cup" },
  });
  const alone = await call(`/api/sessions/${code}/experiments/${second.data.experimentId}/respond`, {
    token: tokenA,
    body: { result: "correct", notes: "Ada again." },
  });
  note("one person cannot session-verify", alone.data?.status !== "verified" && String(alone.data?.reason ?? "").toLowerCase().includes("not shared"), alone.data?.status);

  const third = await call(`/api/sessions/${code}/experiments`, {
    token: tokenA,
    body: { conceptId: accepted.data.conceptId, type: "context_testing", stimulusNote: "the cup in another room" },
  });
  const together = await call(`/api/sessions/${code}/experiments/${third.data.experimentId}/respond`, {
    token: tokenB,
    body: { result: "correct", notes: "Bao matches." },
  });
  note("two people can session-verify", together.data?.status === "verified", together.data?.status ?? together.data?.error);
} finally {
  if (code && tokenA) await call(`/api/sessions/${code}`, { method: "DELETE", token: tokenA, body: { confirmCode: code } });
  if (other.data?.code && other.data?.token) {
    await call(`/api/sessions/${other.data.code}`, { method: "DELETE", token: other.data.token, body: { confirmCode: other.data.code } });
  }
}

const shoreCount = Number(execFileSync("sqlite3", ["data/first-contact.db", "SELECT COUNT(*) FROM Concept WHERE sessionId = (SELECT id FROM DiscoverySession WHERE code = 'SHORE-1001');"], { encoding: "utf8" }).trim());
const remaining = execFileSync("sqlite3", ["data/first-contact.db", "SELECT code FROM DiscoverySession;"], { encoding: "utf8" }).trim();
note("only the demo session remains", shoreCount === 8 && remaining === "SHORE-1001", remaining);

if (failures.length) {
  console.error(`${failures.length} access check(s) failed.`);
  process.exit(1);
}
console.log("Access audit passed. Tokens were not printed.");
