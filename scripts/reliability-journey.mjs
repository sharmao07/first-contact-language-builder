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
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, ok: response.ok, data, text };
}

function png() {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  return new Blob([bytes], { type: "image/png" });
}

function wav() {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(0, 40);
  return new Blob([header], { type: "audio/wav" });
}

async function main() {
  const landing = await fetch(`${base}/`);
  note("1 landing", landing.ok && (await landing.text()).includes("Meaning begins before language"), `HTTP ${landing.status}`);

  const health = await call("/api/health");
  note("health responds", health.status === 200 || health.status === 503, `HTTP ${health.status} mode=${health.data?.mode ?? "missing"}`);
  note(
    "health reports database separately",
    health.data?.ok === (health.data?.database?.connected === true) && typeof health.data?.database?.connected === "boolean",
    health.data?.database ? `connected=${health.data.database.connected} ok=${health.data.ok}` : "no database field; ok is not a connectivity check",
  );

  const created = await call("/api/sessions", {
    body: { name: "Reliability audit", displayName: "Ada", role: "A", description: "Isolated journey" },
  });
  const code = created.data?.code;
  const tokenA = created.data?.token;
  note("2 create session A", created.status === 201 && Boolean(code) && Boolean(tokenA) && !JSON.stringify(created.data).includes("sk-"), `HTTP ${created.status}`);

  const joined = await call("/api/sessions/join", {
    body: { code, displayName: "Bao", role: "B" },
  });
  const tokenB = joined.data?.token;
  note("5 join session B", joined.status === 200 && Boolean(tokenB) && tokenB !== tokenA, `HTTP ${joined.status}`);

  const viewA = await call(`/api/sessions/${code}`, { token: tokenA });
  const viewB = await call(`/api/sessions/${code}`, { token: tokenB });
  const namesA = (viewA.data?.participants ?? []).map((item) => item.displayName).sort().join(",");
  const namesB = (viewB.data?.participants ?? []).map((item) => item.displayName).sort().join(",");
  note("6 both see the same session", viewA.ok && viewB.ok && namesA === namesB && namesA.includes("Ada") && namesA.includes("Bao"), namesA);

  async function evidence(token, fields, file, filename) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    if (file) form.set("file", file, filename);
    return call(`/api/sessions/${code}/evidence`, { token, form });
  }

  const image = await evidence(tokenA, {
    type: "image",
    description: "A glass of water on the table.",
    notes: "Ada points at the glass.",
    stance: "observation",
  }, png(), "glass.png");
  note("7 upload image", image.status === 201 && Boolean(image.data?.evidenceId), `HTTP ${image.status} ${image.data?.error ?? ""}`);

  const drawing = await evidence(tokenA, {
    type: "drawing",
    description: "A side view of a cup.",
    notes: "Drawn in the session.",
    stance: "observation",
  }, png(), "cup.png");
  note("8 capture drawing", drawing.status === 201, `HTTP ${drawing.status} ${drawing.data?.error ?? ""}`);

  const audio = await evidence(tokenB, {
    type: "audio",
    description: "A short tap, not speech.",
    notes: "Recorded by Bao.",
    stance: "observation",
    durationMs: "400",
  }, wav(), "tap.wav");
  note("9 add audio", audio.status === 201, `HTTP ${audio.status} ${audio.data?.error ?? ""}`);

  const gesture = await evidence(tokenB, {
    type: "gesture",
    description: "Hand lifts an imaginary cup to the mouth.",
    notes: "No file. Description only.",
    actionCategory: "drinking",
    stance: "observation",
    gestureDirection: "toward the mouth",
    gestureRepetition: "once",
    gestureBody: "one hand",
  });
  note("10 gesture description", gesture.status === 201, `HTTP ${gesture.status} ${gesture.data?.error ?? ""}`);

  const media = await fetch(`${base}/api/media/${image.data.evidenceId}?code=${code}`);
  const mediaBytes = Buffer.from(await media.arrayBuffer());
  note("11 image retrieval", media.ok && mediaBytes[0] === 0x89, `HTTP ${media.status} bytes=${mediaBytes.length}`);
  const foreign = await fetch(`${base}/api/media/${image.data.evidenceId}?code=TREE-0000`);
  note("cross-session media blocked", foreign.status === 404, `HTTP ${foreign.status}`);

  const analysis = await call(`/api/sessions/${code}/analyze`, {
    token: tokenA,
    body: { evidenceId: image.data.evidenceId },
  });
  note("12 hypotheses", analysis.ok && analysis.data?.hypothesisIds?.length >= 2, `HTTP ${analysis.status} count=${analysis.data?.hypothesisIds?.length ?? 0}`);

  const afterAnalysis = await call(`/api/sessions/${code}`, { token: tokenA });
  const hypothesis = (afterAnalysis.data?.hypotheses ?? []).find((item) => item.id === analysis.data?.hypothesisIds?.[0]);
  note("13 provenance", Boolean(hypothesis) && hypothesis.simulated === true && hypothesis.source === "ai" && hypothesis.status !== "accepted", `source=${hypothesis?.source} simulated=${hypothesis?.simulated} status=${hypothesis?.status}`);
  note("14 not auto-verified", (afterAnalysis.data?.concepts ?? []).every((item) => item.status !== "verified"), `concepts=${(afterAnalysis.data?.concepts ?? []).map((item) => item.status).join(",") || "none"}`);

  const accepted = await call(`/api/sessions/${code}/hypotheses/${hypothesis.id}`, {
    token: tokenB,
    body: { action: "accept", category: "water", meaning: "Water, the substance" },
  });
  note("15 accept hypothesis", accepted.ok && accepted.data?.status !== "verified" && Boolean(accepted.data?.conceptId), `HTTP ${accepted.status} status=${accepted.data?.status}`);

  const first = await call(`/api/sessions/${code}/experiments`, {
    token: tokenA,
    body: { conceptId: accepted.data.conceptId, type: "contrast_testing", stimulusNote: "glass on the table" },
  });
  note("16 create experiment", first.status === 201 || first.ok, `HTTP ${first.status} ${first.data?.error ?? ""}`);
  const answerB = await call(`/api/sessions/${code}/experiments/${first.data.experimentId}/respond`, {
    token: tokenB,
    body: { result: "correct", selectedOptionId: accepted.data.conceptId, notes: "Bao matches the glass" },
  });
  note("17 B responds", answerB.ok && answerB.data?.status !== "verified", `status=${answerB.data?.status}`);

  const second = await call(`/api/sessions/${code}/experiments`, {
    token: tokenA,
    body: { conceptId: accepted.data.conceptId, type: "repeated_verification", stimulusNote: "a different cup, not the first glass" },
  });
  note("18 second method", second.ok && second.data?.experimentId !== first.data?.experimentId, `HTTP ${second.status}`);
  const answerA = await call(`/api/sessions/${code}/experiments/${second.data.experimentId}/respond`, {
    token: tokenA,
    body: { result: "correct", selectedOptionId: accepted.data.conceptId, notes: "Ada matches the second cup" },
  });
  note("19 second response", answerA.ok, `status=${answerA.data?.status}`);
  note("20 session-verified", answerA.data?.status === "verified", answerA.data?.status ?? answerA.data?.error);

  const contradiction = await evidence(tokenB, {
    type: "note",
    description: "Bao uses the same gesture for an empty cup. The substance reading is not settled.",
    stance: "contradictory",
    conceptId: accepted.data.conceptId,
  });
  note("21 contradictory evidence", contradiction.status === 201, `HTTP ${contradiction.status} ${contradiction.data?.error ?? ""}`);
  const reopened = await call(`/api/sessions/${code}`, { token: tokenA });
  const concept = (reopened.data?.concepts ?? []).find((item) => item.id === accepted.data.conceptId);
  note("22 reopened", concept?.status === "reopened", concept?.status);

  const vocab = await call(`/api/sessions/${code}/concepts`, {
    token: tokenA,
    body: {
      agreedMeaning: "Cup, the container",
      category: "objects",
      exampleSituations: "The empty container Ada draws, separate from the liquid.",
      contextualNotes: "Added directly by the participants.",
    },
  });
  note("23 vocabulary entry", vocab.ok && Boolean(vocab.data?.conceptId), `HTTP ${vocab.status} ${vocab.data?.error ?? ""}`);

  const activities = await call(`/api/sessions/${code}/activities`, { token: tokenA, body: { type: "match_example" } });
  const activityId = activities.data?.activityIds?.[0];
  note("24 practice generated", activities.ok && Boolean(activityId), `HTTP ${activities.status} ${activities.data?.error ?? ""}`);
  const activityState = await call(`/api/sessions/${code}`, { token: tokenB });
  const activity = (activityState.data?.activities ?? []).find((item) => item.id === activityId);
  const practice = await call(`/api/sessions/${code}/activities/${activityId}/respond`, {
    token: tokenB,
    body: { selectedOptionId: activity?.answerKey || vocab.data.conceptId },
  });
  note("24 practice answered", practice.ok, `HTTP ${practice.status} ${practice.data?.error ?? ""}`);

  const expression = await call(`/api/sessions/${code}/expressions`, {
    token: tokenA,
    body: {
      title: "Container then substance",
      gloss: "A trial order, not a grammar.",
      grammarNote: "Hypothesis only.",
      contextExample: "Pointing at a full cup.",
      counterexample: "Pointing at a stone.",
      conceptIds: [vocab.data.conceptId, accepted.data.conceptId],
    },
  });
  note("25 expression", expression.ok, `HTTP ${expression.status} ${expression.data?.error ?? ""}`);

  const link = await call(`/api/sessions/${code}/relationships`, {
    token: tokenA,
    body: {
      fromConceptId: vocab.data.conceptId,
      toConceptId: accepted.data.conceptId,
      relationType: "contrasts-with",
      status: "hypothesis",
      notes: "Container versus substance.",
    },
  });
  const graph = await call(`/api/sessions/${code}`, { token: tokenB });
  note("26 graph", link.ok && (graph.data?.relationships ?? []).some((item) => item.id === link.data?.relationshipId), `HTTP ${link.status} edges=${graph.data?.relationships?.length ?? 0}`);

  const report = await fetch(`${base}/api/research/export?format=md&code=${code}`);
  const markdown = await report.text();
  note("27 export", report.ok && markdown.includes("Reliability audit") && markdown.includes("Methodology") && !markdown.includes(tokenA), `HTTP ${report.status}`);

  const againA = await call(`/api/sessions/${code}`, { token: tokenA });
  const againB = await call(`/api/sessions/${code}`, { token: tokenB });
  note("28-29 persist after reload", againA.ok && againB.ok && againA.data?.evidence?.length === againB.data?.evidence?.length && againA.data.evidence.length >= 5, `evidence=${againA.data?.evidence?.length}`);

  const rejoin = await call("/api/sessions/rejoin", { body: { code, token: tokenA } });
  note("recovery key", rejoin.ok && rejoin.data?.role === "A" && rejoin.data?.token === tokenA, `HTTP ${rejoin.status}`);

  const wrongDelete = await call(`/api/sessions/${code}`, {
    method: "DELETE",
    token: tokenB,
    body: { confirmCode: "TREE-0000" },
  });
  note("delete requires the code", wrongDelete.status === 400, `HTTP ${wrongDelete.status}`);

  const shoreBefore = await call("/api/sessions/SHORE-1001");
  const removed = await call(`/api/sessions/${code}`, {
    method: "DELETE",
    token: tokenA,
    body: { confirmCode: code },
  });
  const gone = await call(`/api/sessions/${code}`);
  const shoreAfter = await call("/api/sessions/SHORE-1001");
  note("30 delete only the test session", removed.ok && gone.status === 404 && shoreBefore.ok && shoreAfter.ok && shoreAfter.data?.concepts?.length === shoreBefore.data?.concepts?.length, `delete=${removed.status} gone=${gone.status} shore=${shoreAfter.data?.concepts?.length}`);

  if (failures.length) {
    console.error(`\n${failures.length} journey failure(s).`);
    process.exit(1);
  }
  console.log("\nJourney checks passed. Tokens were not printed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
