import { getProvider } from "@/lib/ai";
import { assertLiveShare } from "@/lib/ai/plan";
import { getAIMode } from "@/lib/ai/config";
import { DISCRIMINATION_DISCLAIMER } from "@/lib/community/selector";
import { prisma } from "@/lib/database/prisma";
import { recordEvent, requireParticipant } from "@/lib/domain/common";
import { presentReplies, type StoredReply } from "@/lib/experiments/privacy";
import { recommendationSchema, type Recommendation } from "@/lib/experiments/schema";
import { reviewRecordedOutcome } from "@/lib/experiments/select";
import type { EngineSnapshot } from "@/lib/experiments/state";
import { HttpError } from "@/lib/http";
import { EXPERIMENT_TYPES } from "@/lib/constants";
import { z } from "zod";

const replySchema = z.object({
  participantId: z.string(),
  body: z.string(),
  stance: z.enum(["matches", "differs", "unsure", "disagree"]),
  lockedAt: z.string().nullable(),
});

export function parseReplies(value: string): StoredReply[] {
  try {
    const parsed = z.array(replySchema).safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function assertPlanner(purpose: string, communityRole: string) {
  if (purpose === "community" && communityRole !== "facilitator") {
    throw new HttpError(403, "In a community session, the facilitator prepares the check. That does not decide the meaning.");
  }
}

async function snapshotFor(sessionId: string): Promise<EngineSnapshot> {
  const [hypotheses, evidence, concepts, experiments, readings, proposals] = await Promise.all([
    prisma.conceptHypothesis.findMany({ where: { sessionId } }),
    prisma.evidence.findMany({ where: { sessionId, deletedAt: null } }),
    prisma.concept.findMany({ where: { sessionId, archivedAt: null } }),
    prisma.verificationExperiment.findMany({ where: { sessionId }, include: { responses: true } }),
    prisma.independentResponse.findMany({ where: { sessionId, lockedAt: { not: null } } }),
    prisma.experimentProposal.findMany({ where: { sessionId, status: { not: "rejected" } } }),
  ]);
  const usedStimuli = [
    ...experiments.map((item) => item.stimulusVariation),
    ...experiments.map((item) => item.stimulusKey),
    ...proposals.flatMap((item) => {
      try {
        const parsed = JSON.parse(item.stimuliJson) as unknown;
        return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
      } catch {
        return [];
      }
    }),
  ];
  return {
    hypotheses: hypotheses.map((item) => ({
      id: item.id,
      meaning: item.proposedMeaning,
      status: item.status,
      explanation: item.explanation,
      supporting: item.supportingEvidence,
      alternatives: item.alternatives,
      missing: item.missingInformation,
      ambiguity: item.culturalAmbiguity,
      evidenceId: item.evidenceId,
      conceptId: item.conceptId,
      simulated: item.simulated,
    })),
    evidence: evidence.map((item) => ({
      id: item.id,
      type: item.type,
      description: item.description,
      notes: item.notes,
      annotation: item.annotation,
      stance: item.stance,
      actionCategory: item.actionCategory,
      consentToAnalyze: item.consentToAnalyze,
    })),
    concepts: concepts.map((item) => ({
      id: item.id,
      meaning: item.agreedMeaning,
      status: item.status,
      alternatives: item.alternativeInterpretations,
    })),
    experiments: experiments.map((item) => ({
      type: item.type,
      stimulusKey: item.stimulusKey,
      stimulusVariation: item.stimulusVariation,
      results: item.responses.map((response) => response.result),
    })),
    readings: readings.map((item) => item.body),
    usedStimuli,
    usedTypes: [...experiments.map((item) => item.type), ...proposals.map((item) => item.experimentType)],
  };
}

export function storedRecommendation(value: string): Recommendation | null {
  try {
    const parsed = recommendationSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function requestExperimentPlans(code: string, token: string | null, input: { taskId?: string; followUp?: boolean; shareWithModel?: boolean }) {
  const { session, participant } = await requireParticipant(code, token);
  assertPlanner(session.purpose, participant.communityRole);
  if (input.taskId) {
    const task = await prisma.communicationTask.findFirst({ where: { id: input.taskId, sessionId: session.id } });
    if (!task) throw new HttpError(404, "That situation is not in this session.");
  }
  if (input.followUp) {
    await prisma.experimentProposal.updateMany({
      where: { sessionId: session.id, status: "proposed" },
      data: { status: "rejected" },
    });
  }
  const open = await prisma.experimentProposal.findMany({ where: { sessionId: session.id, status: "proposed" } });
  if (open.length) {
    return { proposalIds: open.map((item) => item.id), sufficient: true, source: open[0]?.source ?? "rules", simulated: Boolean(open[0]?.simulated), reason: "" };
  }
  assertLiveShare(getAIMode(), Boolean(input.shareWithModel));
  const snapshot = await snapshotFor(session.id);
  let plan;
  try {
    plan = await getProvider().planExperiments(snapshot);
  } catch (error) {
    await recordEvent(session.id, {
      type: "plan.failed",
      message: "Experiment planning failed. No simulated recommendation was saved in its place.",
      participantId: participant.id,
      payload: { taskId: input.taskId ?? null },
    });
    throw error;
  }
  if (!plan.sufficient) {
    await recordEvent(session.id, {
      type: "plan.insufficient",
      message: plan.insufficientReason || "More evidence is needed before a check can be recommended.",
      participantId: participant.id,
      payload: { taskId: input.taskId ?? null },
    });
    return { proposalIds: [], sufficient: false, source: plan.source, simulated: plan.simulated, reason: plan.insufficientReason };
  }
  const proposalIds: string[] = [];
  for (const recommendation of plan.recommendations) {
    const saved = await prisma.experimentProposal.create({
      data: {
        sessionId: session.id,
        taskId: input.taskId ?? null,
        distinguishes: recommendation.competingMeanings.join(" · "),
        missing: recommendation.remainingAmbiguity,
        rationale: recommendation.rationale,
        experimentType: recommendation.experimentType,
        prompt: recommendation.neutralPrompt,
        outcomesJson: JSON.stringify(recommendation.outcomes.map((item) => ({ outcome: item.outcome, supports: item.supports, weakens: item.weakens }))),
        status: "proposed",
        source: plan.source,
        simulated: plan.simulated,
        disclaimer: DISCRIMINATION_DISCLAIMER,
        title: recommendation.title,
        researchQuestion: recommendation.researchQuestion,
        competingIdsJson: JSON.stringify(recommendation.hypothesisIds),
        stimuliJson: JSON.stringify(recommendation.stimuli),
        procedure: recommendation.procedure,
        remainingAmbiguity: recommendation.remainingAmbiguity,
        limitations: recommendation.limitations,
        evidenceRefsJson: JSON.stringify(recommendation.evidenceRefs),
        usefulness: recommendation.usefulness,
        heuristicNote: recommendation.heuristic.measures,
        heuristicScore: recommendation.heuristic.score,
        planJson: JSON.stringify(recommendation),
        providerNote: plan.providerNote,
      },
    });
    proposalIds.push(saved.id);
  }
  await recordEvent(session.id, {
    type: "plan.created",
    message: plan.simulated
      ? "A simulated experiment recommendation was saved. No model analyzed the session, and nothing was verified."
      : "An experiment recommendation was saved. It is not a verified meaning.",
    participantId: participant.id,
    payload: { proposalIds, simulated: plan.simulated },
  });
  return { proposalIds, sufficient: true, source: plan.source, simulated: plan.simulated, reason: "" };
}

export async function rejectExperimentPlan(code: string, token: string | null, proposalId: string) {
  const { session, participant } = await requireParticipant(code, token);
  assertPlanner(session.purpose, participant.communityRole);
  const proposal = await prisma.experimentProposal.findFirst({ where: { id: proposalId, sessionId: session.id } });
  if (!proposal) throw new HttpError(404, "That recommendation is not in this session.");
  if (proposal.status === "approved") throw new HttpError(409, "An approved check stays in the record. It can be followed by a different check.");
  await prisma.experimentProposal.update({ where: { id: proposal.id }, data: { status: "rejected" } });
  await recordEvent(session.id, {
    type: "plan.rejected",
    message: `${participant.displayName} set a recommended check aside.`,
    participantId: participant.id,
    payload: { proposalId },
  });
  return { proposalId };
}

export async function editExperimentPlan(code: string, token: string | null, input: { proposalId: string; prompt: string; title?: string }) {
  const { session, participant } = await requireParticipant(code, token);
  assertPlanner(session.purpose, participant.communityRole);
  const proposal = await prisma.experimentProposal.findFirst({ where: { id: input.proposalId, sessionId: session.id } });
  if (!proposal) throw new HttpError(404, "That recommendation is not in this session.");
  if (proposal.status !== "proposed") throw new HttpError(409, "Only a recommendation that has not been approved can be edited.");
  const recommendation = storedRecommendation(proposal.planJson);
  const prompt = input.prompt.trim();
  const title = input.title?.trim() || proposal.title;
  await prisma.experimentProposal.update({
    where: { id: proposal.id },
    data: {
      prompt,
      title,
      source: "human",
      providerNote: "A participant edited this check. The wording is human-authored.",
      planJson: recommendation ? JSON.stringify({ ...recommendation, neutralPrompt: prompt, title }) : proposal.planJson,
    },
  });
  await recordEvent(session.id, {
    type: "plan.edited",
    message: `${participant.displayName} edited the neutral prompt before approval.`,
    participantId: participant.id,
    payload: { proposalId: proposal.id },
  });
  return { proposalId: proposal.id };
}

export async function approveExperimentPlan(code: string, token: string | null, input: { proposalId: string; conceptId?: string }) {
  const { session, participant } = await requireParticipant(code, token);
  assertPlanner(session.purpose, participant.communityRole);
  const proposal = await prisma.experimentProposal.findFirst({ where: { id: input.proposalId, sessionId: session.id } });
  if (!proposal) throw new HttpError(404, "That recommendation is not in this session.");
  if (proposal.status === "rejected") throw new HttpError(409, "That recommendation was set aside.");
  if (proposal.status === "approved") return { proposalId: proposal.id, experimentId: proposal.createdExperimentId };
  let experimentId: string | null = null;
  if (input.conceptId) {
    const concept = await prisma.concept.findFirst({ where: { id: input.conceptId, sessionId: session.id } });
    if (!concept) throw new HttpError(404, "That concept is not in this session.");
    const stimuli = parseStringList(proposal.stimuliJson);
    const stimulusKey = `${proposal.experimentType}:${stimuli.join("|").toLowerCase()}`;
    const duplicate = await prisma.verificationExperiment.findFirst({ where: { sessionId: session.id, stimulusKey } });
    if (duplicate) throw new HttpError(409, "This repeats a stimulus already used. Ask for a follow-up with a new example.");
    const type = z.enum(EXPERIMENT_TYPES).parse(proposal.experimentType);
    const prior = await prisma.verificationExperiment.count({ where: { conceptId: concept.id } });
    const experiment = await prisma.verificationExperiment.create({
      data: {
        sessionId: session.id,
        conceptId: concept.id,
        type,
        prompt: proposal.prompt,
        optionsJson: "[]",
        stimulusKey,
        stimulusVariation: stimuli.join("; "),
        contextNote: `proposal:${proposal.id}`,
        proposalId: proposal.id,
        round: prior + 1,
      },
    });
    experimentId = experiment.id;
  }
  await prisma.experimentProposal.update({
    where: { id: proposal.id },
    data: { status: "approved", approvedByParticipantId: participant.id, createdExperimentId: experimentId },
  });
  await recordEvent(session.id, {
    type: "plan.approved",
    message: `${participant.displayName} approved a check. Approval does not verify a meaning.`,
    participantId: participant.id,
    payload: { proposalId: proposal.id, experimentId },
  });
  return { proposalId: proposal.id, experimentId };
}

export async function replyToExperimentPlan(code: string, token: string | null, input: { proposalId: string; body: string; stance: StoredReply["stance"] }) {
  const { session, participant } = await requireParticipant(code, token);
  const proposal = await prisma.experimentProposal.findFirst({ where: { id: input.proposalId, sessionId: session.id } });
  if (!proposal || proposal.status !== "approved") throw new HttpError(404, "That check is not open for a response.");
  const replies = parseReplies(proposal.repliesJson);
  const existing = replies.find((item) => item.participantId === participant.id);
  if (existing?.lockedAt) throw new HttpError(409, "You already locked this response.");
  const next: StoredReply = { participantId: participant.id, body: input.body.trim(), stance: input.stance, lockedAt: null };
  const saved = replies.filter((item) => item.participantId !== participant.id).concat(next);
  await prisma.experimentProposal.update({ where: { id: proposal.id }, data: { repliesJson: JSON.stringify(saved) } });
  await recordEvent(session.id, {
    type: "plan.reply",
    message: `${participant.displayName} saved a private response to a check.`,
    participantId: participant.id,
    payload: { proposalId: proposal.id },
  });
  return { proposalId: proposal.id };
}

export async function lockExperimentReply(code: string, token: string | null, proposalId: string) {
  const { session, participant } = await requireParticipant(code, token);
  const proposal = await prisma.experimentProposal.findFirst({ where: { id: proposalId, sessionId: session.id } });
  if (!proposal || proposal.status !== "approved") throw new HttpError(404, "That check is not open for a response.");
  const replies = parseReplies(proposal.repliesJson);
  const existing = replies.find((item) => item.participantId === participant.id);
  if (!existing?.body.trim()) throw new HttpError(400, "Save a response before locking it.");
  const saved = replies.map((item) => item.participantId === participant.id ? { ...item, lockedAt: item.lockedAt ?? new Date().toISOString() } : item);
  await prisma.experimentProposal.update({ where: { id: proposal.id }, data: { repliesJson: JSON.stringify(saved) } });
  await recordEvent(session.id, {
    type: "plan.locked",
    message: `${participant.displayName} locked a response to a check.`,
    participantId: participant.id,
    payload: { proposalId },
  });
  return { proposalId, hiddenFromOther: presentReplies(saved, participant.id).some((item) => item.hidden) };
}

export async function recordExperimentOutcome(code: string, token: string | null, input: { proposalId: string; outcome: string }) {
  const { session, participant } = await requireParticipant(code, token);
  assertPlanner(session.purpose, participant.communityRole);
  const proposal = await prisma.experimentProposal.findFirst({ where: { id: input.proposalId, sessionId: session.id } });
  if (!proposal) throw new HttpError(404, "That recommendation is not in this session.");
  const replies = parseReplies(proposal.repliesJson);
  const locked = new Set(replies.filter((item) => item.lockedAt).map((item) => item.participantId));
  if (locked.size < 2) throw new HttpError(409, "Both people need to lock a response before the outcome is compared.");
  const recommendation = storedRecommendation(proposal.planJson);
  if (!recommendation) throw new HttpError(409, "This check has no stored plan to compare against.");
  const review = reviewRecordedOutcome(recommendation, input.outcome);
  if (!review) throw new HttpError(400, "Choose one of the outcomes written in the plan.");
  await prisma.experimentProposal.update({
    where: { id: proposal.id },
    data: { recordedOutcome: input.outcome, outcomeReviewJson: JSON.stringify(review) },
  });
  await recordEvent(session.id, {
    type: "plan.reviewed",
    message: `${participant.displayName} compared the locked responses with the plan. No meaning was verified.`,
    participantId: participant.id,
    payload: { proposalId: proposal.id },
  });
  return { proposalId: proposal.id, verified: false };
}

function parseStringList(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
