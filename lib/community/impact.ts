export type ImpactInput = {
  illustrative: boolean;
  createdAt: string;
  tasks: Array<{ outcome: string; createdAt: string }>;
  concepts: Array<{ status: string; updatedAt: string }>;
  lockedResponses: number;
  experiments: number;
  disagreements: number;
};

export type ImpactSummary = {
  sample: boolean;
  simulated: false;
  note: string;
  tasksAttempted: number;
  sessionVerified: number;
  unresolved: number;
  independentResponses: number;
  experiments: number;
  misunderstandingsCorrected: number;
  repeatedAttempts: number;
  minutesToFirstAgreement: number | null;
};

export function summarizeImpact(input: ImpactInput): ImpactSummary {
  const verified = input.concepts.filter((item) => item.status === "verified");
  const first = verified
    .map((item) => new Date(item.updatedAt).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)[0];
  const started = new Date(input.createdAt).getTime();
  const minutes = first && Number.isFinite(started) ? Math.max(0, Math.round((first - started) / 60000)) : null;
  return {
    sample: input.illustrative,
    simulated: false,
    note: input.illustrative
      ? "These counts are from the illustrative sample session. They are not field observations and they do not measure a change in inequality."
      : "These counts are from this session's own record. A prototype session does not show that inequality has been reduced.",
    tasksAttempted: input.tasks.length,
    sessionVerified: verified.length,
    unresolved: input.concepts.filter((item) => item.status !== "verified" && item.status !== "archived").length,
    independentResponses: input.lockedResponses,
    experiments: input.experiments,
    misunderstandingsCorrected: input.disagreements,
    repeatedAttempts: input.tasks.filter((item) => item.outcome === "another-round").length,
    minutesToFirstAgreement: minutes,
  };
}
