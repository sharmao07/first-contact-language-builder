export type TestResult = "correct" | "incorrect" | "ambiguous" | "disagree";

export type VerificationStatus =
  | "hypothesis"
  | "awaiting"
  | "tentative"
  | "verified"
  | "disputed"
  | "reopened"
  | "archived";

/**
 * One recorded response inside a check.
 * stimulusKey identifies the example. Two responses that share it are not two pieces of evidence.
 * decisive false means the response is kept in the history but cannot confirm a meaning.
 */
export type CheckRecord = {
  result: TestResult;
  stimulusKey: string;
  experimentType: string;
  decisive?: boolean;
};

export function independentMatches(checks: CheckRecord[]) {
  const byStimulus = new Map<string, string>();
  for (const check of checks) {
    if (check.decisive === false || check.result !== "correct") continue;
    if (!check.stimulusKey) continue;
    byStimulus.set(check.stimulusKey, check.experimentType);
  }
  return {
    stimuli: byStimulus.size,
    methods: new Set(byStimulus.values()).size,
  };
}

/**
 * Session-verified means the participants' own checks met the rule below.
 * It does not mean the meaning is a linguistic fact outside this session.
 *
 * The rule:
 * - a participant has accepted the wording
 * - no disagreement is on record for the current round
 * - at least two correct responses use different stimuli
 * - those stimuli come from at least two different check methods
 * - at least three quarters of recorded responses in the round match
 */
export function deriveVerificationStatus(input: {
  archived: boolean;
  disputed: boolean;
  participantAccepted: boolean;
  reopened?: boolean;
  checks: CheckRecord[];
}): { status: VerificationStatus; reason: string } {
  if (input.archived) {
    return {
      status: "archived",
      reason: "A participant archived this entry. It stays in the history and is left out of practice.",
    };
  }
  const disagreements = input.checks.filter((check) => check.result === "disagree").length;
  if (input.disputed || disagreements > 0) {
    return {
      status: "disputed",
      reason: input.disputed
        ? "A participant marked this meaning as disputed. It is not treated as established."
        : "A check recorded a disagreement. The meaning stays disputed until the participants resolve it with a new round of checks.",
    };
  }
  if (!input.participantAccepted) {
    return {
      status: "hypothesis",
      reason: "No participant has accepted an interpretation. AI suggestions remain proposals, even if a check was answered.",
    };
  }
  const tests = input.checks.length;
  const correct = input.checks.filter((check) => check.result === "correct" && check.decisive !== false).length;
  const ambiguous = input.checks.filter((check) => check.result === "ambiguous").length;
  const matches = independentMatches(input.checks);
  const rate = tests === 0 ? 0 : correct / tests;
  const sessionVerified = matches.stimuli >= 2 && matches.methods >= 2 && correct >= 2 && rate >= 0.75;
  if (sessionVerified) {
    return {
      status: "verified",
      reason:
        "Session-verified inside this session only. At least two different check methods, on different stimuli, matched, with no disagreements, and at least three quarters of recorded responses matched. This is not a claim of linguistic truth, and it can be reopened.",
    };
  }
  if (tests === 0) {
    return input.reopened
      ? {
          status: "reopened",
          reason: "New contradictory evidence reopened this entry. Earlier checks stay in the history and do not carry over. It is not session-verified.",
        }
      : {
          status: "tentative",
          reason: "Participants accepted a wording. No check has been recorded, so this is tentatively accepted, not session-verified.",
        };
  }
  const sameMethod = matches.stimuli >= 2 && matches.methods < 2;
  const ambiguousNote = ambiguous ? ` ${ambiguous} ambiguous response${ambiguous === 1 ? "" : "s"} did not count as confirmation.` : "";
  const reason = sameMethod
    ? `More than one match is on record, but they use the same kind of check. A second method, with a different stimulus, is still required. One success is not enough, and repeating one experiment does not count twice.${ambiguousNote}`
    : `Checks are incomplete or mixed. Ambiguous responses do not confirm a meaning, and two answers to the same stimulus count once.${ambiguousNote}`;
  return input.reopened
    ? { status: "reopened", reason: `${reason} This entry was reopened, so only checks after the reopen count.` }
    : { status: "awaiting", reason };
}
