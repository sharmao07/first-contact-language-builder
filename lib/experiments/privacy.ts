export type PlanViewer = { id: string; communityRole: string } | null;

export type StoredReply = {
  participantId: string;
  body: string;
  stance: "matches" | "differs" | "unsure" | "disagree";
  lockedAt: string | null;
};

export function seesResearchPlan(purpose: string, viewer: { communityRole: string } | null) {
  if (purpose !== "community") return true;
  return viewer?.communityRole === "facilitator";
}

export function visibleOpenHypothesisCount(purpose: string, viewer: { communityRole: string } | null, count: number) {
  return seesResearchPlan(purpose, viewer) ? count : 0;
}

export function presentReplies(replies: StoredReply[], viewerId: string | null) {
  const locked = new Set(replies.filter((item) => item.lockedAt).map((item) => item.participantId));
  const open = locked.size >= 2;
  return replies.map((reply) => {
    const own = Boolean(viewerId) && reply.participantId === viewerId;
    if (own || (open && reply.lockedAt)) return { ...reply, hidden: false };
    return { participantId: reply.participantId, body: "", stance: "", lockedAt: reply.lockedAt, hidden: true };
  });
}

export function hiddenPlanText(value: string) {
  return /supports the reading|stays possible|weakens/i.test(value);
}

export function redactPrivateEvent(type: string, message: string, seesPlan: boolean) {
  if (seesPlan) return message;
  if (type.startsWith("hypothesis.")) return "A reading was updated. The wording stays with the person guiding the check.";
  if (type === "experiment.answered") return "A check response was recorded. The result stays hidden until both people have answered.";
  if (type === "task.outcome") return "An outcome was recorded. It does not decide what the expression means.";
  return message;
}

export function hideEventPayload(type: string, seesPlan: boolean) {
  if (seesPlan) return false;
  return type.startsWith("analysis") || type.startsWith("plan") || type.startsWith("hypothesis.") || type === "experiment.answered" || type === "task.outcome";
}
