import { describe, expect, it } from "vitest";
import { ACCESS_NOTES, accessRole, canDeleteEvidence, canExportSession, canReadSession } from "@/lib/access/policy";
import { BENCHMARK } from "@/lib/experiments/benchmark";
import { DRAFT_LIMIT } from "@/lib/experiments/outcomes";
import { buildRulePlan } from "@/lib/experiments/select";
import { deriveVerificationStatus } from "@/lib/verification/status";

describe("access roles", () => {
  it("gives visitors no read or export, and does not invent a global research role", () => {
    expect(canReadSession(accessRole(null))).toBe(false);
    expect(canExportSession(accessRole(null))).toBe(false);
    expect(canExportSession(accessRole({ purpose: "community", role: "B", communityRole: "participant" }))).toBe(false);
    expect(canExportSession(accessRole({ purpose: "general", role: "B", communityRole: "" }))).toBe(false);
    expect(canExportSession(accessRole({ purpose: "community", role: "A", communityRole: "facilitator" }))).toBe(true);
    expect(canExportSession(accessRole({ purpose: "research", role: "A", communityRole: "" }))).toBe(true);
    expect(ACCESS_NOTES.researchAdministrator).toContain("No research-administrator");
    const participant = { purpose: "community", role: "B", communityRole: "participant" };
    expect(canDeleteEvidence(participant, "seat-a", "seat-b")).toBe(false);
    expect(canDeleteEvidence(participant, "seat-b", "seat-b")).toBe(true);
    expect(canDeleteEvidence({ purpose: "community", role: "A", communityRole: "facilitator" }, "seat-b", "seat-a")).toBe(true);
  });
});

describe("shared verification", () => {
  const thresholds = [
    { result: "correct" as const, stimulusKey: "visual:a", experimentType: "visual_discrimination", authorId: "facilitator" },
    { result: "correct" as const, stimulusKey: "contrast:b", experimentType: "contrast_testing", authorId: "facilitator" },
  ];

  it("does not treat one person's two matches as session-verified", () => {
    const status = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: thresholds,
    });
    expect(status.status).toBe("awaiting");
    expect(status.reason.toLowerCase()).toContain("not shared verification");
    expect(status.reason.toLowerCase()).not.toContain("session-verified inside");
  });

  it("session-verifies only after a second person records a different matching check", () => {
    const status = deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [
        thresholds[0],
        { ...thresholds[1], authorId: "participant" },
      ],
    });
    expect(status.status).toBe("verified");
    expect(status.reason.toLowerCase()).toContain("not a claim of linguistic truth");
  });

  it("still rejects one method, one stimulus, and a disagreement", () => {
    expect(deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [
        { result: "correct", stimulusKey: "same", experimentType: "visual_discrimination", authorId: "a" },
        { result: "correct", stimulusKey: "same", experimentType: "contrast_testing", authorId: "b" },
      ],
    }).status).not.toBe("verified");
    expect(deriveVerificationStatus({
      archived: false,
      disputed: false,
      participantAccepted: true,
      checks: [
        { result: "correct", stimulusKey: "one", experimentType: "visual_discrimination", authorId: "a" },
        { result: "disagree", stimulusKey: "two", experimentType: "contrast_testing", authorId: "b" },
      ],
    }).status).toBe("disputed");
  });
});

describe("stimulus-specific outcomes", () => {
  it("ties the object-versus-substance check to the examples and drafts a check it cannot map", () => {
    const water = BENCHMARK.find((item) => item.id === "object-substance");
    if (!water) throw new Error("missing scenario");
    const plan = buildRulePlan(water.snapshot);
    const visual = plan.recommendations.find((item) => item.experimentType === "visual_discrimination");
    expect(visual?.reviewState).toBe("ready");
    expect(visual?.outcomes[0]?.expectedUnder.map((cell) => cell.expectation).join(" ")).toContain("holder");
    expect(visual?.limitations).not.toContain(DRAFT_LIMIT);
    const vague = buildRulePlan({
      ...water.snapshot,
      hypotheses: water.snapshot.hypotheses.map((item, index) => ({ ...item, meaning: index === 0 ? "Blorp" : "Snath" })),
    });
    expect(vague.recommendations.some((item) => item.reviewState === "draft" && item.limitations.includes("Draft."))).toBe(true);
    expect(vague.recommendations.filter((item) => item.reviewState === "draft").every((item) => item.outcomes.every((outcome) => outcome.distinguishes === false))).toBe(true);
  });
});
