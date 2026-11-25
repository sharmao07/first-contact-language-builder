const base = process.env.SMOKE_BASE ?? "http://127.0.0.1:3010";

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
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} -> ${response.status} ${typeof data === "string" ? data : data?.error || text}`);
  }
  return data;
}

function png() {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  return new Blob([bytes], { type: "image/png" });
}

async function main() {
  const health = await call("/api/health");
  if (!health.ok || !health.mode) throw new Error("Health check failed.");

  const empty = await call("/api/sessions", { body: { name: " ", displayName: "Ada", role: "A" } }).then(
    () => {
      throw new Error("Empty session name was accepted.");
    },
    () => "rejected",
  );
  if (empty !== "rejected") throw new Error("Validation did not fail.");

  const created = await call("/api/sessions", {
    body: { name: "Smoke session", displayName: "Ada", role: "A", description: "Smoke" },
  });
  const joined = await call("/api/sessions/join", {
    body: { code: created.code, displayName: "Bao", role: "B" },
  });

  const form = new FormData();
  form.set("type", "image");
  form.set("description", "A glass of water on the table.");
  form.set("notes", "Ada points and mimes drinking.");
  form.set("actionCategory", "drinking");
  form.set("file", png(), "drop.png");
  const evidence = await call(`/api/sessions/${created.code}/evidence`, { token: created.token, form });
  const analysis = await call(`/api/sessions/${created.code}/analyze`, {
    token: created.token,
    body: { evidenceId: evidence.evidenceId },
  });
  if (!analysis.hypothesisIds?.length) throw new Error("No hypotheses.");
  if (analysis.simulated !== true && health.mode === "demo") throw new Error("Demo analysis was not marked simulated.");

  const state = await call(`/api/sessions/${created.code}`, { token: created.token });
  const hypothesis = state.hypotheses.find((item) => item.id === analysis.hypothesisIds[0]);
  if (!hypothesis || hypothesis.status === "accepted") throw new Error("A hypothesis was verified automatically.");

  const accepted = await call(`/api/sessions/${created.code}/hypotheses/${hypothesis.id}`, {
    token: created.token,
    body: { action: "accept", category: "water", meaning: "Water, the substance" },
  });
  if (accepted.status === "verified") throw new Error("Acceptance verified a meaning with no checks.");

  const other = await call(`/api/sessions/${created.code}/concepts`, {
    token: created.token,
    body: { agreedMeaning: "Tree", category: "nature" },
  });
  await call(`/api/sessions/${created.code}/relationships`, {
    token: created.token,
    body: {
      fromConceptId: accepted.conceptId,
      toConceptId: other.conceptId,
      relationType: "contrast",
      status: "hypothesis",
      notes: "Smoke link",
    },
  });

  const experiment = await call(`/api/sessions/${created.code}/experiments`, {
    token: created.token,
    body: { conceptId: accepted.conceptId, type: "contrast_testing" },
  });
  await call(`/api/sessions/${created.code}/experiments/${experiment.experimentId}/respond`, {
    token: joined.token,
    body: { result: "correct", selectedOptionId: accepted.conceptId, notes: "First check" },
  });
  const second = await call(`/api/sessions/${created.code}/experiments`, {
    token: created.token,
    body: { conceptId: accepted.conceptId, type: "repeated_verification" },
  });
  const afterSecond = await call(`/api/sessions/${created.code}/experiments/${second.experimentId}/respond`, {
    token: created.token,
    body: { result: "correct", selectedOptionId: accepted.conceptId, notes: "Different example" },
  });
  if (afterSecond.status !== "verified") throw new Error(`Expected verified after two checks, got ${afterSecond.status}.`);

  const activities = await call(`/api/sessions/${created.code}/activities`, { token: created.token, body: {} });
  if (!activities.activityIds?.length) throw new Error("Practice was not generated from real entries.");

  await call(`/api/sessions/${created.code}/expressions`, {
    token: created.token,
    body: {
      title: "Water then tree",
      gloss: "A trial order, not a translation.",
      grammarNote: "Grammar hypothesis only.",
      conceptIds: [accepted.conceptId, other.conceptId],
    },
  });

  const exported = await fetch(`${base}/api/research/export?format=md&code=${created.code}`, {
    headers: { "x-participant-token": created.token },
  });
  const report = await exported.text();
  if (!exported.ok || !report.includes("Smoke session")) throw new Error("Markdown export failed.");

  const media = await fetch(`${base}/api/media/${evidence.evidenceId}?code=TREE-0000`);
  if (media.status !== 404) throw new Error("Foreign session code could read media.");

  const wrong = await fetch(`${base}/api/sessions/TREE-0000/evidence/${evidence.evidenceId}`, {
    method: "DELETE",
    headers: { "x-participant-token": created.token, "content-type": "application/json" },
    body: "{}",
  });
  if (wrong.status < 400) throw new Error("Cross-session delete succeeded.");

  await call(`/api/sessions/${created.code}`, {
    method: "DELETE",
    token: created.token,
    body: { confirmCode: created.code },
  });
  console.log("Smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
