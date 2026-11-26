import { describe, expect, it } from "vitest";
import { demoAnalyze } from "@/lib/ai/demo-provider";
import { buildActivities } from "@/lib/learning/build";
import { toMarkdown } from "@/lib/research/format";
import { assertSameSession, generateSessionCode, isSessionCode, nextConceptCode } from "@/lib/session/codes";
import { isSafeRelative } from "@/lib/storage/files";
import { createSessionSchema } from "@/lib/validation/schemas";
import { analysisSchema } from "@/lib/ai/schema";
import { mediaPlan } from "@/lib/ai/openai-provider";
import { getAIMode } from "@/lib/ai/config";
import { buildExperiment, stimulusIdentity } from "@/lib/verification/experiments";
import { independentMatches, deriveVerificationStatus } from "@/lib/verification/status";
import { displayStatus } from "@/lib/constants";

describe("session codes", () => {
  it("generates a human-readable code", () => {
    const code = generateSessionCode();
    expect(isSessionCode(code)).toBe(true);
  });

  it("numbers concept codes from existing ones", () => {
    expect(nextConceptCode(["C-001", "C-004"])).toBe("C-005");
    expect(nextConceptCode([])).toBe("C-001");
  });

  it("rejects cross-session records", () => {
    expect(() => assertSameSession("a", "b")).toThrow(/isolation/);
    expect(() => assertSameSession("a", "a")).not.toThrow();
  });
});

describe("verification", () => {
  it("does not verify a single success", () => {
    const result = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [{ result: "correct", stimulusKey: "visual:a", experimentType: "visual_discrimination" }],
    });
    expect(result.status).not.toBe("verified");
    expect(result.status).toBe("awaiting");
  });

  it("verifies only after two methods and two stimuli", () => {
    const result = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [
        { result: "correct", stimulusKey: "visual:a", experimentType: "visual_discrimination", authorId: "a" },
        { result: "correct", stimulusKey: "contrast:b", experimentType: "contrast_testing", authorId: "b" },
      ],
    });
    expect(result.status).toBe("verified");
    expect(result.reason.toLowerCase()).toContain("session-verified");
  });

  it("keeps disagreements disputed", () => {
    const result = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [
        { result: "correct", stimulusKey: "visual:a", experimentType: "visual_discrimination" },
        { result: "correct", stimulusKey: "contrast:b", experimentType: "contrast_testing" },
        { result: "disagree", stimulusKey: "context:c", experimentType: "context_testing" },
      ],
    });
    expect(result.status).toBe("disputed");
  });

  it("leaves an accepted idea tentative until a check exists", () => {
    const result = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [],
    });
    expect(result.status).toBe("tentative");
  });
});

describe("demo facilitator", () => {
  it("returns competing water readings without claiming to see the file", () => {
    const analysis = demoAnalyze({
      evidenceType: "gesture",
      description: "Points at a glass and mimes drinking water.",
      notes: "",
      actionCategory: "drinking",
      knownConcepts: [],
    });
    expect(analysis.simulated).toBe(true);
    expect(analysis.providerNote.toLowerCase()).toContain("demo mode");
    expect(analysis.hypotheses.length).toBeGreaterThanOrEqual(3);
    const meanings = analysis.hypotheses.map((item) => item.proposedMeaning.toLowerCase()).join(" ");
    expect(meanings).toContain("water");
    expect(meanings).toContain("drinking");
    for (const hypothesis of analysis.hypotheses) {
      expect(hypothesis.confidence).toBeGreaterThanOrEqual(0);
      expect(hypothesis.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("experiments and practice", () => {
  it("only offers meanings that were supplied", () => {
    const draft = buildExperiment({
      type: "contrast_testing",
      round: 2,
      concept: { id: "water", agreedMeaning: "Water", alternativeInterpretations: "A river" },
      siblings: [
        { id: "water", agreedMeaning: "Water", alternativeInterpretations: "" },
        { id: "tree", agreedMeaning: "Tree", alternativeInterpretations: "" },
      ],
    });
    const labels = draft.options.map((option) => option.label);
    expect(labels).toContain("Water");
    expect(labels).toContain("Tree");
    expect(labels.join(" ")).not.toContain("Invented");
  });

  it("does not build practice from disputed entries", () => {
    const drafts = buildActivities({
      concepts: [
        {
          id: "move",
          agreedMeaning: "Movement",
          status: "disputed",
          category: "movement",
          exampleSituations: "A walk",
          alternativeInterpretations: "Come here",
          contextualNotes: "",
        },
      ],
      evidence: [],
      expressions: [],
    });
    expect(drafts).toHaveLength(0);
  });

  it("does not build practice from an accepted reading that is not session-verified", () => {
    const drafts = buildActivities({
      concepts: [
        {
          id: "water",
          agreedMeaning: "Water",
          status: "tentative",
          category: "substance",
          exampleSituations: "A glass of water",
          alternativeInterpretations: "The glass",
          contextualNotes: "",
        },
      ],
      evidence: [{ id: "ev", conceptId: "water", type: "image", description: "A glass", actionCategory: null }],
      expressions: [],
    });
    expect(drafts).toHaveLength(0);
  });
});

describe("validation and files", () => {
  it("rejects an empty session name", () => {
    const parsed = createSessionSchema.safeParse({ name: "  ", displayName: "Ada", role: "A" });
    expect(parsed.success).toBe(false);
  });

  it("blocks path traversal", () => {
    expect(isSafeRelative("../secret.txt")).toBe(false);
    expect(isSafeRelative("session/file.png")).toBe(true);
  });
});

describe("research report", () => {
  it("marks illustrative sessions and does not include secrets", () => {
    const markdown = toMarkdown({
      generatedAt: "2026-04-12T00:00:00.000Z",
      sessions: [
        {
          code: "SHORE-1001",
          name: "First Contact Experiment 001",
          illustrative: true,
          description: "Sample",
          participants: ["Researcher A (A)"],
          concepts: [],
          notes: [],
          relationships: [],
        },
      ],
    });
    expect(markdown).toContain("Illustrative");
    expect(markdown).toContain("Methodology");
    expect(markdown).toContain("Limitations");
    expect(markdown.toLowerCase()).not.toContain("api key");
    expect(markdown).not.toContain("sk-");
  });
});

describe("phase 2 verification independence", () => {
  it("does not count the same stimulus twice", () => {
    const matches = independentMatches([
      { result: "correct", stimulusKey: "same", experimentType: "visual_discrimination" },
      { result: "correct", stimulusKey: "same", experimentType: "visual_discrimination" },
    ]);
    expect(matches.stimuli).toBe(1);
    const status = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [
        { result: "correct", stimulusKey: "same", experimentType: "visual_discrimination" },
        { result: "correct", stimulusKey: "same", experimentType: "contrast_testing" },
      ],
    });
    expect(status.status).not.toBe("verified");
  });

  it("does not verify two successes that use only one method", () => {
    const status = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [
        { result: "correct", stimulusKey: "visual:one", experimentType: "visual_discrimination" },
        { result: "correct", stimulusKey: "visual:two", experimentType: "visual_discrimination" },
      ],
    });
    expect(status.status).toBe("awaiting");
  });

  it("does not verify from checks when nobody accepted the wording", () => {
    const status = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: false,
      checks: [
        { result: "correct", stimulusKey: "visual:a", experimentType: "visual_discrimination" },
        { result: "correct", stimulusKey: "contrast:b", experimentType: "contrast_testing" },
      ],
    });
    expect(status.status).toBe("hypothesis");
  });

  it("reopens instead of staying session-verified when the round has no new checks", () => {
    const status = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      reopened: true,
      checks: [],
    });
    expect(status.status).toBe("reopened");
  });

  it("treats a repeated empty note as the same stimulus", () => {
    const first = stimulusIdentity("repeated_verification", [], "");
    const second = stimulusIdentity("repeated_verification", [], "  ");
    expect(first).toBe(second);
    const changed = stimulusIdentity("repeated_verification", [], "a different glass");
    expect(changed).not.toBe(first);
  });
});

describe("phase 2 facilitator boundaries", () => {
  it("rejects a confidence outside 0 to 1", () => {
    const parsed = analysisSchema.safeParse({
      observations: ["A glass is described."],
      ambiguities: ["It could be the vessel."],
      followUps: ["Show an empty glass."],
      hypotheses: [
        {
          proposedMeaning: "Cup",
          explanation: "The notes mention a vessel.",
          supportingEvidence: "Written description.",
          alternatives: "A drink.",
          confidence: 4,
          suggestedExperiment: "Contrast it with a bowl.",
        },
        {
          proposedMeaning: "Drink",
          explanation: "The notes mention drinking.",
          supportingEvidence: "Written description.",
          alternatives: "A request.",
          confidence: 0.2,
          suggestedExperiment: "Mime the action with no object.",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("does not send media without consent", () => {
    const plan = mediaPlan({
      evidenceType: "image",
      description: "A glass",
      notes: "",
      actionCategory: null,
      mimeType: "image/png",
      mediaBytes: Buffer.from("png"),
      consentToAnalyze: false,
      knownConcepts: [],
    });
    expect(plan.sendImage).toBe(false);
    expect(plan.note.toLowerCase()).toContain("consent");
  });

  it("does not invent an audio transcription when no audio model is configured", () => {
    const previous = process.env.OPENAI_AUDIO_MODEL;
    delete process.env.OPENAI_AUDIO_MODEL;
    const plan = mediaPlan({
      evidenceType: "audio",
      description: "A short sound",
      notes: "",
      actionCategory: null,
      mimeType: "audio/wav",
      mediaBytes: Buffer.from("wav"),
      consentToAnalyze: true,
      knownConcepts: [],
    });
    expect(plan.sendAudio).toBe(false);
    expect(plan.note.toLowerCase()).toContain("not sent");
    if (previous) process.env.OPENAI_AUDIO_MODEL = previous;
  });

  it("stays in demo mode without a key", () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "";
    expect(getAIMode()).toBe("demo");
    process.env.AI_PROVIDER = previousProvider;
    process.env.OPENAI_API_KEY = previousKey;
  });

  it("marks demo output as simulated and does not claim to see the file", () => {
    const analysis = demoAnalyze({
      evidenceType: "image",
      description: "A tree",
      notes: "",
      actionCategory: null,
      fileName: "tree.png",
      mediaBytes: Buffer.from("not-read"),
      knownConcepts: [],
    });
    expect(analysis.simulated).toBe(true);
    expect(analysis.cannotDetermine.join(" ").toLowerCase()).toContain("not inspected");
    expect(analysis.hypotheses[0]?.missingInformation).toBeTruthy();
  });
});

describe("claim labels", () => {
  it("keeps a guess, a facilitator-supported observation, a dispute, and session verification distinct", () => {
    expect(displayStatus("open")).toBe("Guess");
    expect(displayStatus("hypothesis", "No participant has accepted an interpretation.")).toBe("Guess");
    expect(displayStatus("hypothesis")).toBe("Proposed");
    expect(displayStatus("awaiting", "Facilitator-supported observation. One person recorded the matching checks. This is not shared verification.")).toBe("Facilitator-supported observation");
    expect(displayStatus("disputed")).toBe("Disputed");
    expect(displayStatus("verified")).toBe("Session-verified");
    expect(displayStatus("tentative")).toBe("Accepted, not session-verified");
  });
});
