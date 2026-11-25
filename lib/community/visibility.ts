export type ResponseRecord = {
  id: string;
  taskId: string;
  authorParticipantId: string;
  kind: string;
  body: string;
  lockedAt: string | null;
  mediaUrl: string | null;
};

export type ResponseView = ResponseRecord & { hidden: boolean };

export function comparisonOpen(responses: Array<{ authorParticipantId: string; lockedAt: string | null }>, step: string) {
  void step;
  const lockedAuthors = new Set(responses.filter((item) => item.lockedAt).map((item) => item.authorParticipantId));
  return lockedAuthors.size >= 2;
}

export function presentResponse(response: ResponseRecord, viewerId: string | null, open: boolean): ResponseView {
  const own = Boolean(viewerId) && response.authorParticipantId === viewerId;
  if (own || (open && response.lockedAt)) return { ...response, hidden: false };
  return { ...response, body: "", mediaUrl: null, hidden: true };
}
