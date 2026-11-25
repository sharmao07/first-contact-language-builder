export type Seat = {
  purpose: string;
  role: string;
  communityRole: string;
};

export type AccessRole = "visitor" | "participant" | "host" | "facilitator";

export function accessRole(seat: Seat | null): AccessRole {
  if (!seat) return "visitor";
  if (seat.purpose === "community") {
    return seat.communityRole === "facilitator" ? "facilitator" : "participant";
  }
  return seat.role === "A" ? "host" : "participant";
}

export function canReadSession(role: AccessRole) {
  return role !== "visitor";
}

export function canExportSession(role: AccessRole) {
  return role === "facilitator" || role === "host";
}

export function canMutateHypotheses(seat: Seat) {
  const role = accessRole(seat);
  return role === "facilitator" || role === "host";
}

export const ACCESS_NOTES = {
  visitor: "No session list, no session record, and no export. A code is only used to join.",
  participant: "Reads the participant view of one session. Cannot export facilitator notes, hypotheses, or private evidence descriptions.",
  host: "Seat A in a research or general session. Reads that session and may export only that session.",
  facilitator: "Community facilitator. Reads the full session and may export only that session.",
  researchAdministrator: "No research-administrator credential exists. There is no role that can export every session.",
} as const;
