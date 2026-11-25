import { afterEach, describe, expect, it } from "vitest";
import { proposeDiscrimination } from "@/lib/community/propose";
import { BENCHMARK } from "@/lib/experiments/benchmark";
import { redactPrivateEvent } from "@/lib/experiments/privacy";
import { evaluateRecommendation } from "@/lib/experiments/quality";
import { buildRulePlan } from "@/lib/experiments/select";
import { communityResearchVisible } from "@/lib/domain/research";
import { deriveVerificationStatus } from "@/lib/verification/status";

describe("private event text", () => {
  it("removes hypothesis wording, check results, and recorded outcomes from a community participant view", () => {
    expect(redactPrivateEvent("hypothesis.proposed", "Ada proposed “The container”.", false)).not.toContain("container");
    expect(redactPrivateEvent("experiment.answered", "Ada recorded “correct” for a check.", false)).not.toContain("correct");
    expect(redactPrivateEvent("task.outcome", "Ada recorded the outcome “They match only the liquid.”", false)).not.toContain("liquid");
    expect(redactPrivateEvent("hypothesis.proposed", "Ada proposed “The container”.", true)).toContain("container");
  });

  it("keeps community research detail with the facilitator of that session only", () => {
    expect(communityResearchVisible("community", "s1", null)).toBe(false);
    expect(communityResearchVisible("community", "s1", { sessionId: "s1", communityRole: "participant" })).toBe(false);
    expect(communityResearchVisible("community", "s1", { sessionId: "s1", communityRole: "facilitator" })).toBe(true);
    expect(communityResearchVisible("research", "s1", null)).toBe(true);
  });
});

describe("object versus substance", () => {
  it("does not rank the container wording as the strongest check", () => {
    const scenario = BENCHMARK.find((item) => item.id === "object-substance");
    if (!scenario) throw new Error("missing scenario");
    const plan = buildRulePlan(scenario.snapshot);
    const ranked = plan.recommendations
      .map((item) => ({ item, quality: evaluateRecommendation(item, scenario.snapshot) }))
      .sort((left, right) => right.quality.passed - left.quality.passed);
    expect(ranked[0]?.item.neutralPrompt.toLowerCase()).not.toContain("container");
    const visual = ranked.find((item) => item.item.experimentType === "visual_discrimination");
    expect(visual?.item.reviewState).toBe("ready");
    expect(visual?.item.neutralPrompt.toLowerCase()).not.toContain("container");
    expect(visual?.item.outcomes[0]?.expectedUnder.some((cell) => cell.expectation.includes("holder"))).toBe(true);
    expect(visual?.quality.note.toLowerCase()).toContain("not a probability");
  });
});

describe("verification still needs more than one check", () => {
  it("does not treat one correct answer or an approval as session-verified", () => {
    const one = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [{ result: "correct", stimulusKey: "a", experimentType: "contrast_testing" }],
    });
    expect(one.status).not.toBe("verified");
    const sameStimulus = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [
        { result: "correct", stimulusKey: "a", experimentType: "contrast_testing" },
        { result: "correct", stimulusKey: "a", experimentType: "repeated_verification" },
      ],
    });
    expect(sameStimulus.status).not.toBe("verified");
  });
});

describe("community discrimination fallback", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousMode = process.env.AI_PROVIDER;
  afterEach(() => {
    process.env.OPENAI_API_KEY = previousKey;
    process.env.AI_PROVIDER = previousMode;
  });

  it("does not save a rule draft when a live discrimination request fails", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response("busy", { status: 429 });
    try {
      await expect(proposeDiscrimination(["the container", "the water"])).rejects.toThrow(/No rule-based check was substituted/);
    } finally {
      globalThis.fetch = original;
    }
  });
});
