export type TimelineItem = {
  id: string;
  at: string;
  kind: string;
  label: string;
  detail: string;
};

export function buildTimeline(input: {
  evidence: Array<{ id: string; description: string; createdAt: string }>;
  hypotheses: Array<{ id: string; meaning: string; createdAt: string; simulated: boolean }>;
  proposals: Array<{ id: string; title: string; status: string; experimentType: string; createdAt: string; recordedOutcome: string }>;
  replies: Array<{ proposalId: string; participantId: string; lockedAt: string | null; stance: string }>;
  disagreements: Array<{ id: string; createdAt: string; detail: string }>;
}): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const item of input.evidence) {
    items.push({
      id: `evidence-${item.id}`,
      at: item.createdAt,
      kind: "evidence",
      label: "Evidence recorded",
      detail: item.description || "An example was added. No meaning was assigned by the file itself.",
    });
  }
  for (const item of input.hypotheses) {
    items.push({
      id: `hypothesis-${item.id}`,
      at: item.createdAt,
      kind: "hypothesis",
      label: item.simulated ? "Simulated competing reading" : "Competing reading",
      detail: item.meaning,
    });
  }
  for (const item of input.proposals) {
    items.push({
      id: `proposal-${item.id}`,
      at: item.createdAt,
      kind: "recommendation",
      label: item.status === "approved" ? "Check approved" : item.status === "rejected" ? "Check rejected" : "Check recommended",
      detail: item.title || item.experimentType,
    });
    if (item.recordedOutcome) {
      items.push({
        id: `outcome-${item.id}`,
        at: item.createdAt,
        kind: "outcome",
        label: "Outcome compared with the plan",
        detail: item.recordedOutcome,
      });
    }
  }
  for (const reply of input.replies) {
    if (!reply.lockedAt) continue;
    items.push({
      id: `reply-${reply.proposalId}-${reply.participantId}`,
      at: reply.lockedAt,
      kind: "response",
      label: reply.stance === "disagree" ? "Disagreement locked" : "Response locked",
      detail: reply.stance === "disagree" ? "A participant disagreed. The reading stays unresolved." : "A participant locked a response to the neutral prompt.",
    });
  }
  for (const item of input.disagreements) {
    items.push({
      id: `disagree-${item.id}`,
      at: item.createdAt,
      kind: "disagreement",
      label: "Disagreement on record",
      detail: item.detail,
    });
  }
  return items.sort((left, right) => left.at.localeCompare(right.at) || left.id.localeCompare(right.id));
}
