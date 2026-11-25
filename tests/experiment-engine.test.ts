import { afterEach, describe, expect, it } from "vitest";
import { requestLivePlan } from "@/lib/ai/plan";
import { SIMULATED_PLAN_NOTE } from "@/lib/experiments/schema";
import { buildRulePlan, reviewRecordedOutcome } from "@/lib/experiments/select";
import { presentReplies, seesResearchPlan } from "@/lib/experiments/privacy";
import { buildTimeline } from "@/lib/experiments/timeline";
import type { EngineSnapshot } from "@/lib/experiments/state";
import { deriveVerificationStatus } from "@/lib/verification/status";
import { HttpError } from "@/lib/http";

const water: EngineSnapshot = {
  hypotheses: [
    hypothesis("h1", "Water, the substance"),
    hypothesis("h2", "The action of drinking"),
    hypothesis("h3", "A container"),
  ],
  evidence: [{
    id: "e1",
    type: "image",
    description: "A person points at a glass and mimes drinking.",
    notes: "The glass may be the object, the liquid, or the request.",
    annotation: "",
    stance: "observation",
    actionCategory: "drinking",
  }],
  concepts: [],
  experiments: [],
  readings: ["water", "cup"],
  usedStimuli: [],
  usedTypes: [],
};

function hypothesis(id: string, meaning: string): EngineSnapshot["hypotheses"][number] {
  return {
    id,
    meaning,
    status: "open",
    explanation: "A written reading.",
    supporting: "The description mentions a glass and a drink.",
    alternatives: "Another reading is still possible.",
    missing: "The parts have not been shown separately.",
    ambiguity: "One scene contains the object and the action.",
    evidenceId: "e1",
    conceptId: null,
    simulated: true,
  };
}

describe("experiment plans", () => {
  it("recommends a distinguishing check from the recorded readings", () => {
    const plan = buildRulePlan(water);
    expect(plan.sufficient).toBe(true);
    expect(plan.providerNote).toBe(SIMULATED_PLAN_NOTE);
    expect(plan.recommendations.length).toBeGreaterThan(0);
    expect(plan.recommendations[0]?.stimuli.join(" ")).toContain("holder, shown empty");
    expect(plan.recommendations[0]?.reviewState).toBe("ready");
    expect(plan.recommendations[0]?.outcomes[0]?.expectedUnder.some((cell) => cell.expectation.includes("holder"))).toBe(true);
    expect(plan.recommendations[0]?.neutralPrompt.toLowerCase()).not.toContain("stays possible");
    expect(plan.recommendations[0]?.heuristic.measures.toLowerCase()).toContain("checklist");
    expect(plan.recommendations[0]?.heuristic.measures.toLowerCase()).toContain("not information gain");
    expect(plan.inspection.toLowerCase()).not.toContain("inspected the image");
    const types = new Set(plan.recommendations.map((item) => item.experimentType));
    expect(types.size).toBe(plan.recommendations.length);
  });

  it("asks for another reading instead of inventing a check", () => {
    const plan = buildRulePlan({ ...water, hypotheses: [water.hypotheses[0]], readings: [] });
    expect(plan.sufficient).toBe(false);
    expect(plan.recommendations).toEqual([]);
    expect(plan.insufficientReason.toLowerCase()).toContain("one reading");
  });

  it("asks for evidence when nothing has been recorded", () => {
    const plan = buildRulePlan({ ...water, hypotheses: [], evidence: [], readings: [] });
    expect(plan.sufficient).toBe(false);
    expect(plan.recommendations).toEqual([]);
  });

  it("prefers a stimulus that has not already been used", () => {
    const repeated = buildRulePlan({
      ...water,
      usedStimuli: ["the empty container", "the container holding liquid", "the drinking motion with empty hands"],
      usedTypes: ["visual_discrimination"],
    });
    const stimuli = repeated.recommendations[0]?.stimuli ?? [];
    expect(stimuli.join(" ")).not.toContain("empty container");
  });

  it("does not turn one planned result into session verification", () => {
    const plan = buildRulePlan(water);
    const review = reviewRecordedOutcome(plan.recommendations[0], plan.recommendations[0].outcomes[0].outcome);
    expect(review?.verified).toBe(false);
    const status = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [{ result: "correct", stimulusKey: "one", experimentType: "visual_discrimination" }],
    });
    expect(status.status).not.toBe("verified");
  });
});

describe("plan privacy", () => {
  it("hides the other person's draft until both responses lock", () => {
    const hidden = presentReplies([
      { participantId: "a", body: "matches the liquid", stance: "matches", lockedAt: "2026-11-24T00:00:00.000Z" },
    ], "b");
    expect(hidden[0]?.body).toBe("");
    const open = presentReplies([
      { participantId: "a", body: "matches the liquid", stance: "matches", lockedAt: "2026-11-24T00:00:00.000Z" },
      { participantId: "b", body: "the cup", stance: "differs", lockedAt: "2026-11-24T00:01:00.000Z" },
    ], "b");
    expect(open.every((item) => item.hidden === false)).toBe(true);
  });

  it("keeps outcome mappings with the facilitator in a community session", () => {
    expect(seesResearchPlan("community", { communityRole: "participant" })).toBe(false);
    expect(seesResearchPlan("community", { communityRole: "facilitator" })).toBe(true);
    expect(seesResearchPlan("research", { communityRole: "" })).toBe(true);
  });
});

describe("timeline", () => {
  it("keeps evidence, a recommendation, and a disagreement in order", () => {
    const items = buildTimeline({
      evidence: [{ id: "e", description: "A glass.", createdAt: "2026-11-24T00:00:00.000Z" }],
      hypotheses: [{ id: "h", meaning: "Water", createdAt: "2026-11-24T00:01:00.000Z", simulated: true }],
      proposals: [{ id: "p", title: "Separate the liquid", status: "approved", experimentType: "visual_discrimination", createdAt: "2026-11-24T00:02:00.000Z", recordedOutcome: "" }],
      replies: [{ proposalId: "p", participantId: "b", lockedAt: "2026-11-24T00:03:00.000Z", stance: "disagree" }],
      disagreements: [],
    });
    expect(items.map((item) => item.kind)).toEqual(["evidence", "hypothesis", "recommendation", "response"]);
    expect(items[1]?.detail).toBe("Water");
  });
});

describe("live planner failures", () => {
  const previous = process.env.OPENAI_API_KEY;
  afterEach(() => {
    process.env.OPENAI_API_KEY = previous;
  });

  it("does not replace a rate limit or invalid JSON with a simulated plan", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    await expect(requestLivePlan(water, async () => new Response("busy", { status: 429 }))).rejects.toMatchObject({ status: 429 });
    await expect(requestLivePlan(water, async () => new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 }))).rejects.toBeInstanceOf(HttpError);
    try {
      await requestLivePlan(water, async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }));
      throw new Error("invalid plan was accepted");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).message).toContain("No simulated plan was substituted");
    }
  });
});
