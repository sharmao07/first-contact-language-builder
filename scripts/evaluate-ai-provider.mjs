import http from "node:http";
import assert from "node:assert/strict";

const MOCK_OUTPUTS = {
  ambiguousHypotheses: {
    observations: ["A hand reaches toward a ceramic cup containing clear liquid."],
    ambiguities: ["Could label the liquid, the container, the act of drinking, or a polite offer."],
    inferences: ["May be a noun for water/vessel or a request verb."],
    cannotDetermine: ["No spoken audio was analyzed; acoustic form is unknown."],
    followUps: ["Contrast drinking from the cup vs. pointing to an empty cup."],
    hypotheses: [
      {
        proposedMeaning: "water / liquid",
        explanation: "Participant gestures toward clear liquid inside the vessel.",
        supportingEvidence: "Pointing toward cup interior in synthetic note.",
        alternatives: "drinking action, ceramic cup, offering politely",
        missingInformation: "Whether empty cup evokes the same sign.",
        culturalAmbiguity: "Pointing etiquette and container/contents metonymy vary.",
        confidence: 0.45,
        suggestedExperiment: "Compare full cup with empty cup in visual discrimination.",
      },
      {
        proposedMeaning: "cup / container",
        explanation: "Focus may be on the vessel rather than contents.",
        supportingEvidence: "Touch near cup rim.",
        alternatives: "water, drinking, hold",
        missingInformation: "Reaction to water without a cup.",
        culturalAmbiguity: "Artifact shape vs. substance naming.",
        confidence: 0.35,
        suggestedExperiment: "Test with poured water in a different bowl.",
      },
      {
        proposedMeaning: "drink (action)",
        explanation: "Upward cup motion mimics ingestion.",
        supportingEvidence: "Action label recorded as drinking.",
        alternatives: "water, cup",
        missingInformation: "Passive vs. imperative distinction.",
        culturalAmbiguity: "Mime conventions are not universal.",
        confidence: 0.4,
        suggestedExperiment: "Mime drinking without holding an object.",
      },
    ],
  },
  validPlan: {
    sufficient: true,
    insufficientReason: "",
    simulated: false,
    source: "ai",
    inspection: "Model reviewed consented text only.",
    providerNote: "Synthetic eval plan",
    analyses: [
      {
        id: "h-water",
        meaning: "water / liquid",
        status: "open",
        supporting: ["Consented photo note mentions clear liquid inside cup"],
        contradictory: [],
        missing: "Test with empty vessel",
        ambiguity: "Could mean container rather than contents",
        distinguishing: "Empty ceramic cup vs leaf bowl with water",
        needsInput: true,
      },
      {
        id: "h-cup",
        meaning: "cup / container",
        status: "open",
        supporting: ["Hand points near rim"],
        contradictory: [],
        missing: "Test with water poured into another vessel",
        ambiguity: "Could mean contents rather than vessel",
        distinguishing: "Empty ceramic cup vs leaf bowl with water",
        needsInput: true,
      },
    ],
    overlaps: [
      {
        meanings: ["water / liquid", "cup / container"],
        reason: "Both appear together in the initial cup photograph.",
      },
    ],
    recommendations: [
      {
        title: "Container versus contents check",
        researchQuestion: "Does the sign track the liquid or the vessel?",
        competingMeanings: ["water / liquid", "cup / container"],
        hypothesisIds: ["h-water", "h-cup"],
        experimentType: "visual_discrimination",
        stimuli: ["Empty ceramic cup", "Water in leaf bowl"],
        procedure: "Show each stimulus separately without naming either guess.",
        neutralPrompt: "Point to the example that belongs with the earlier sign.",
        outcomes: [
          {
            outcome: "Participant chooses empty cup",
            expectedUnder: [
              { meaning: "water / liquid", expectation: "Unlikely because no liquid is present." },
              { meaning: "cup / container", expectation: "Consistent with vessel meaning." },
            ],
            supports: "cup / container",
            weakens: "water / liquid",
            distinguishes: true,
            remainingAmbiguity: "Shape or material bounds remain open.",
          },
          {
            outcome: "Participant chooses water in leaf bowl",
            expectedUnder: [
              { meaning: "water / liquid", expectation: "Consistent with liquid meaning." },
              { meaning: "cup / container", expectation: "Unlikely because no ceramic cup is present." },
            ],
            supports: "water / liquid",
            weakens: "cup / container",
            distinguishes: true,
            remainingAmbiguity: "Drinking action vs. static water remains open.",
          },
        ],
        remainingAmbiguity: "Imperative request vs. noun label remains unsettled.",
        usefulness: "Separates two overlapping concrete hypotheses.",
        limitations: "Static objects do not isolate verbs.",
        evidenceRefs: ["ev-1"],
        rationale: "Contrasts container and contents.",
        heuristic: {
          score: 7,
          measures: "Checklist score out of 8, not a probability and not information gain.",
        },
      },
    ],
  },
};

async function startControlledServer() {
  let mode = "ok-analysis";
  let rateCount = 0;
  let lastRequestBody = null;

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
      res.writeHead(404).end();
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    lastRequestBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    if (mode === "malformed") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "not valid json {{{" } }] }));
      return;
    }
    if (mode === "bad-schema") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ unexpected: true }) } }] }));
      return;
    }
    if (mode === "rate-limit") {
      rateCount += 1;
      res.writeHead(429, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Rate limit exceeded" } }));
      return;
    }
    if (mode === "server-error") {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Upstream error" } }));
      return;
    }
    if (mode === "timeout") {
      await new Promise((r) => setTimeout(r, 4500));
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
      return;
    }

    const payload = mode === "ok-plan" ? MOCK_OUTPUTS.validPlan : MOCK_OUTPUTS.ambiguousHypotheses;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  return {
    baseUrl: `http://127.0.0.1:${addr.port}/v1`,
    setMode: (next) => { mode = next; rateCount = 0; },
    getRateCount: () => rateCount,
    getLastRequest: () => lastRequestBody,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function run() {
  const srv = await startControlledServer();
  process.env.AI_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "eval-controlled-local-key";
  process.env.OPENAI_BASE_URL = srv.baseUrl;
  process.env.OPENAI_MODEL = "gpt-4o-mini";
  process.env.AI_TIMEOUT_MS = "3000";

  const { openAIProvider } = await import("../lib/ai/openai-provider.ts");
  const { requestLivePlan, groundSnapshot } = await import("../lib/ai/plan.ts");

  const snapshot = {
    session: { id: "s1", code: "TEST-0001", name: "Eval", purpose: "research" },
    concepts: [{ id: "c1", conceptCode: "C-001", status: "tentative", meaning: "water", alternatives: "cup" }],
    hypotheses: [
      { id: "h-water", conceptId: "c1", proposedMeaning: "water / liquid", explanation: "Clear liquid", alternatives: "cup", confidence: 0.45, status: "open" },
      { id: "h-cup", conceptId: "c1", proposedMeaning: "cup / container", explanation: "Vessel", alternatives: "water", confidence: 0.35, status: "open" },
    ],
    evidence: [
      { id: "ev-1", type: "image", description: "Consented photo of cup with water", notes: "", annotation: "", consentToAnalyze: true },
      { id: "ev-2", type: "note", description: "SECRET UNCONSENTED TEXT", notes: "PRIVATE NOTE", annotation: "", consentToAnalyze: false },
    ],
    usedStimuli: [],
    usedMethods: [],
  };

  try {
    // 1. Consent omission verification
    const grounded = groundSnapshot(snapshot);
    assert.equal(grounded.omittedEvidence, 1);
    assert.equal(JSON.stringify(grounded.snapshot).includes("SECRET UNCONSENTED TEXT"), false);
    console.log("PASS 1. unconsented evidence omitted from model payload (omittedEvidence=1)");

    // 2. Ambiguous hypotheses over HTTP (consented vs non-consented)
    srv.setMode("ok-analysis");
    const analysis = await openAIProvider.analyze({
      evidenceType: "image",
      description: "Cup with water",
      notes: "",
      actionCategory: "drinking",
      fileName: "cup.png",
      mimeType: "image/png",
      mediaBytes: Buffer.from("fake-png-bytes"),
      consentToAnalyze: false,
      knownConcepts: [],
    });
    assert.equal(analysis.simulated, false);
    assert.equal(analysis.hypotheses.length, 3);
    assert.equal(JSON.stringify(srv.getLastRequest()).includes("image_url"), false);
    console.log("PASS 2. ambiguous hypotheses parsed (count=3, simulated=false, unconsented image bytes withheld)");

    // 3. Experiment planning structured validation + server quality scoring
    srv.setMode("ok-plan");
    const plan = await requestLivePlan(snapshot);
    assert.equal(plan.simulated, false);
    assert.equal(plan.source, "ai");
    assert.ok(plan.recommendations[0].quality && typeof plan.recommendations[0].quality.passed === "number");
    assert.equal(JSON.stringify(srv.getLastRequest()).includes("SECRET UNCONSENTED TEXT"), false);
    console.log(`PASS 3. structured experiment plan validated & server-scored (score=${plan.recommendations[0].quality.passed}/8)`);

    // 4. Malformed JSON rejected (HTTP 502, no simulated fallback)
    srv.setMode("malformed");
    await assert.rejects(() => openAIProvider.analyze({
      evidenceType: "note", description: "test", notes: "", actionCategory: null, consentToAnalyze: true, knownConcepts: [],
    }), (err) => err?.status === 502);
    await assert.rejects(() => requestLivePlan(snapshot), (err) => err?.status === 502 && err.message.includes("No simulated plan"));
    console.log("PASS 4. malformed JSON fails closed with HTTP 502 (no simulated fallback)");

    // 5. Schema mismatch rejected (HTTP 502, no simulated fallback)
    srv.setMode("bad-schema");
    await assert.rejects(() => openAIProvider.analyze({
      evidenceType: "note", description: "test", notes: "", actionCategory: null, consentToAnalyze: true, knownConcepts: [],
    }), (err) => err?.status === 502);
    await assert.rejects(() => requestLivePlan(snapshot), (err) => err?.status === 502);
    console.log("PASS 5. schema mismatch fails closed with HTTP 502 (no simulated fallback)");

    // 6. Rate limit 429 retried once cleanly and fails closed (HTTP 429)
    srv.setMode("rate-limit");
    await assert.rejects(() => requestLivePlan(snapshot), (err) => err?.status === 429 && err.message.includes("No simulated plan"));
    assert.equal(srv.getRateCount(), 2);
    console.log("PASS 6. HTTP 429 retried once (attempts=2) and fails closed with HTTP 429");

    // 7. Upstream HTTP 500 fails closed (HTTP 502)
    srv.setMode("server-error");
    await assert.rejects(() => requestLivePlan(snapshot), (err) => err?.status === 502 && err.message.includes("No simulated plan"));
    console.log("PASS 7. upstream HTTP 500 fails closed with HTTP 502 (no simulated fallback)");

    // 8. Timeout fails closed (HTTP 504)
    srv.setMode("timeout");
    await assert.rejects(() => openAIProvider.analyze({
      evidenceType: "note", description: "test", notes: "", actionCategory: null, consentToAnalyze: true, knownConcepts: [],
    }), (err) => err?.status === 504);
    await assert.rejects(() => requestLivePlan(snapshot), (err) => err?.status === 504 && err.message.includes("No simulated plan"));
    console.log("PASS 8. timeout (3000ms) fails closed with HTTP 504 (no simulated fallback)");
  } finally {
    await srv.close();
  }
}

run().catch((err) => {
  console.error("AI evaluation harness failed:", err);
  process.exit(1);
});
