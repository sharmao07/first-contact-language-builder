import { describe, expect, it } from "vitest";
import { summarizeImpact } from "@/lib/community/impact";
import { selectDiscriminatingExperiment } from "@/lib/community/selector";
import { comparisonOpen, presentResponse } from "@/lib/community/visibility";
import { createSessionSchema } from "@/lib/validation/schemas";

describe("community access", () => {
  it("requires an explicit consent confirmation", () => {
    const parsed = createSessionSchema.safeParse({
      name: "Market",
      displayName: "Ada",
      purpose: "community",
      consent: false,
    });
    expect(parsed.success).toBe(false);
  });

  it("keeps a private draft hidden from the other person", () => {
    const draft = {
      id: "r1",
      taskId: "t1",
      authorParticipantId: "a",
      kind: "interpretation",
      body: "water",
      lockedAt: null,
      mediaUrl: null,
    };
    const hidden = presentResponse(draft, "b", false);
    expect(hidden.hidden).toBe(true);
    expect(hidden.body).toBe("");
    const own = presentResponse(draft, "a", false);
    expect(own.body).toBe("water");
  });

  it("releases locked responses only after comparison is open", () => {
    const locked = {
      id: "r1",
      taskId: "t1",
      authorParticipantId: "a",
      kind: "drawing",
      body: "12,12 20,20",
      lockedAt: "2026-11-24T00:00:00.000Z",
      mediaUrl: null,
    };
    expect(presentResponse(locked, "b", false).body).toBe("");
    expect(comparisonOpen([
      { authorParticipantId: "a", lockedAt: locked.lockedAt },
      { authorParticipantId: "b", lockedAt: null },
    ], "respond")).toBe(false);
    expect(comparisonOpen([
      { authorParticipantId: "a", lockedAt: locked.lockedAt },
    ], "test")).toBe(false);
    expect(presentResponse(locked, "b", true).body).toBe(locked.body);
  });
});

describe("experiment selection", () => {
  it("separates water, drinking, and a container without verifying a winner", () => {
    const proposal = selectDiscriminatingExperiment(["water", "drinking", "container"]);
    expect(proposal.experimentType).toBe("contrast_testing");
    expect(proposal.outcomes.length).toBeGreaterThanOrEqual(3);
    expect(proposal.disclaimer.toLowerCase()).not.toContain("optimal");
    expect(proposal.prompt.toLowerCase()).toContain("empty");
    expect(JSON.stringify(proposal).toLowerCase()).not.toContain("verified meaning");
  });

  it("still proposes a check when the readings are unfamiliar", () => {
    const proposal = selectDiscriminatingExperiment(["blorp", "snath"]);
    expect(proposal.outcomes.length).toBeGreaterThanOrEqual(2);
    expect(proposal.prompt).toContain("blorp");
  });
});

describe("impact counts", () => {
  it("counts only the rows it is given", () => {
    const summary = summarizeImpact({
      illustrative: false,
      createdAt: "2026-11-24T10:00:00.000Z",
      tasks: [{ outcome: "another-round", createdAt: "2026-11-24T10:05:00.000Z" }],
      concepts: [
        { status: "verified", updatedAt: "2026-11-24T10:20:00.000Z" },
        { status: "tentative", updatedAt: "2026-11-24T10:10:00.000Z" },
      ],
      lockedResponses: 2,
      experiments: 1,
      disagreements: 1,
    });
    expect(summary.simulated).toBe(false);
    expect(summary.tasksAttempted).toBe(1);
    expect(summary.sessionVerified).toBe(1);
    expect(summary.unresolved).toBe(1);
    expect(summary.repeatedAttempts).toBe(1);
    expect(summary.minutesToFirstAgreement).toBe(20);
    expect(summary.note).toContain("does not show that inequality has been reduced");
  });

  it("labels the sample session as a sample", () => {
    const summary = summarizeImpact({
      illustrative: true,
      createdAt: "2026-11-24T10:00:00.000Z",
      tasks: [],
      concepts: [],
      lockedResponses: 0,
      experiments: 0,
      disagreements: 0,
    });
    expect(summary.sample).toBe(true);
    expect(summary.note).toContain("not field observations");
  });
});
