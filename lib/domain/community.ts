import { EXPERIMENT_TYPES } from "@/lib/constants";
import { prisma } from "@/lib/database/prisma";
import { recordEvent, requireParticipant } from "@/lib/domain/common";
import { createExperiment } from "@/lib/domain/checks";
import { z } from "zod";
import { summarizeImpact } from "@/lib/community/impact";
import { proposeDiscrimination } from "@/lib/community/propose";
import { scenarioById, SCENARIO_STEPS, type ScenarioStep } from "@/lib/community/scenarios";
import { HttpError } from "@/lib/http";
import type { communityActionSchema } from "@/lib/validation/schemas";

function nextStep(current: string, target: ScenarioStep) {
  const from = SCENARIO_STEPS.indexOf(current as ScenarioStep);
  const to = SCENARIO_STEPS.indexOf(target);
  return from < to ? target : current;
}

export async function applyCommunityAction(code: string, token: string | null, input: z.infer<typeof communityActionSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  if (input.action === "create-task") {
    const template = scenarioById(input.templateId);
    if (!template) throw new HttpError(400, "Choose one of the guided situations.");
    const task = await prisma.communicationTask.create({
      data: { sessionId: session.id, templateId: template.id, title: template.title, category: template.category },
    });
    await recordEvent(session.id, {
      type: "task.created",
      message: `${participant.displayName} opened “${template.title}”.`,
      participantId: participant.id,
      payload: { taskId: task.id, templateId: template.id },
    });
    return { taskId: task.id };
  }

  if (input.action === "show") {
    const task = await taskInSession(session.id, input.taskId);
    await prisma.communicationTask.update({
      where: { id: task.id },
      data: { shownNote: input.note ?? task.shownNote, step: nextStep(task.step, "respond") },
    });
    await recordEvent(session.id, {
      type: "task.shown",
      message: `${participant.displayName} showed an example for “${task.title}”.`,
      participantId: participant.id,
      payload: { taskId: task.id },
    });
    return { ok: true };
  }

  if (input.action === "respond") {
    const task = await taskInSession(session.id, input.taskId);
    if (["compare", "ambiguity", "test", "outcome"].includes(task.step)) {
      throw new HttpError(409, "Responses are locked for this step. Start another round if you need a new response.");
    }
    const existing = await prisma.independentResponse.findUnique({
      where: { taskId_authorParticipantId: { taskId: task.id, authorParticipantId: participant.id } },
    });
    if (existing?.lockedAt) throw new HttpError(409, "You already locked this response.");
    const body = input.body.trim();
    if (!body) throw new HttpError(400, "Add a drawing, a gesture note, or a short reading before saving.");
    const saved = existing
      ? await prisma.independentResponse.update({ where: { id: existing.id }, data: { kind: input.kind, body } })
      : await prisma.independentResponse.create({
          data: { sessionId: session.id, taskId: task.id, authorParticipantId: participant.id, kind: input.kind, body },
        });
    if (task.step === "show") {
      await prisma.communicationTask.update({ where: { id: task.id }, data: { step: "respond" } });
    }
    await recordEvent(session.id, {
      type: "response.saved",
      message: `${participant.displayName} saved a private response. The other person cannot read it yet.`,
      participantId: participant.id,
      payload: { taskId: task.id, responseId: saved.id },
    });
    return { responseId: saved.id };
  }

  if (input.action === "lock") {
    const task = await taskInSession(session.id, input.taskId);
    const existing = await prisma.independentResponse.findUnique({
      where: { taskId_authorParticipantId: { taskId: task.id, authorParticipantId: participant.id } },
    });
    if (!existing || !existing.body.trim()) throw new HttpError(400, "Save a response before locking it.");
    if (!existing.lockedAt) {
      await prisma.independentResponse.update({ where: { id: existing.id }, data: { lockedAt: new Date() } });
    }
    const locked = await prisma.independentResponse.findMany({ where: { taskId: task.id, lockedAt: { not: null } } });
    const authors = new Set(locked.map((item) => item.authorParticipantId));
    if (authors.size >= 2) {
      await prisma.communicationTask.update({ where: { id: task.id }, data: { step: nextStep(task.step, "compare") } });
    }
    await recordEvent(session.id, {
      type: "response.locked",
      message: `${participant.displayName} locked a response for “${task.title}”.`,
      participantId: participant.id,
      payload: { taskId: task.id },
    });
    return { ok: true, compared: authors.size >= 2 };
  }

  if (input.action === "ambiguity") {
    const task = await taskInSession(session.id, input.taskId);
    await prisma.communicationTask.update({
      where: { id: task.id },
      data: { ambiguityNote: input.note, step: nextStep(task.step, "ambiguity") },
    });
    await recordEvent(session.id, {
      type: "task.ambiguity",
      message: `${participant.displayName} noted what is still unclear.`,
      participantId: participant.id,
      payload: { taskId: task.id },
    });
    return { ok: true };
  }

  if (input.action === "propose") {
    const task = await taskInSession(session.id, input.taskId);
    const open = await prisma.experimentProposal.findFirst({ where: { taskId: task.id, status: "proposed" } });
    if (open) return { proposalId: open.id, source: open.source };
    const locked = await prisma.independentResponse.findMany({ where: { taskId: task.id, lockedAt: { not: null } } });
    const interpretations = (input.interpretations?.length ? input.interpretations : locked.map((item) => item.body)).map((item) => item.trim()).filter(Boolean);
    const proposal = await proposeDiscrimination(interpretations);
    const saved = await prisma.experimentProposal.create({
      data: {
        sessionId: session.id,
        taskId: task.id,
        distinguishes: proposal.draft.distinguishes,
        missing: proposal.draft.missing,
        rationale: proposal.draft.rationale,
        experimentType: proposal.draft.experimentType,
        prompt: proposal.draft.prompt,
        outcomesJson: JSON.stringify(proposal.draft.outcomes),
        source: proposal.source,
        simulated: proposal.simulated,
        disclaimer: proposal.draft.disclaimer,
      },
    });
    await prisma.communicationTask.update({ where: { id: task.id }, data: { step: nextStep(task.step, "test") } });
    await recordEvent(session.id, {
      type: "proposal.created",
      message: `${participant.displayName} received a suggested check. It is not a verified meaning.`,
      participantId: participant.id,
      payload: { taskId: task.id, proposalId: saved.id, source: proposal.source },
    });
    return { proposalId: saved.id, source: proposal.source };
  }

  if (input.action === "approve") {
    if (session.purpose === "community" && participant.communityRole !== "facilitator") {
      throw new HttpError(403, "In a community session, the facilitator approves the check. Approval does not decide the meaning.");
    }
    const proposal = await prisma.experimentProposal.findFirst({ where: { id: input.proposalId, sessionId: session.id } });
    if (!proposal) throw new HttpError(404, "That suggestion is not in this session.");
    if (proposal.status === "approved") return { proposalId: proposal.id, experimentId: proposal.createdExperimentId };
    let experimentId: string | null = null;
    if (input.conceptId) {
      const created = await createExperiment(code, token, {
        conceptId: input.conceptId,
        type: z.enum(EXPERIMENT_TYPES).parse(proposal.experimentType),
        stimulusNote: `proposal:${proposal.id}`,
      });
      experimentId = created.experimentId;
    }
    await prisma.experimentProposal.update({
      where: { id: proposal.id },
      data: { status: "approved", approvedByParticipantId: participant.id, createdExperimentId: experimentId },
    });
    if (proposal.taskId) {
      const task = await taskInSession(session.id, proposal.taskId);
      await prisma.communicationTask.update({ where: { id: task.id }, data: { step: nextStep(task.step, "test") } });
    }
    await recordEvent(session.id, {
      type: "proposal.approved",
      message: experimentId
        ? `${participant.displayName} approved a check. The concept stays unverified until the usual evidence rules are met.`
        : `${participant.displayName} approved a check to run in the session. No concept was marked verified.`,
      participantId: participant.id,
      payload: { proposalId: proposal.id, experimentId },
    });
    return { proposalId: proposal.id, experimentId };
  }

  const task = await taskInSession(session.id, input.taskId);
  await prisma.communicationTask.update({
    where: { id: task.id },
    data: { outcome: input.outcome, outcomeNote: input.note ?? "", step: "outcome" },
  });
  await recordEvent(session.id, {
    type: "task.outcome",
    message: `${participant.displayName} recorded the outcome “${input.outcome}” for “${task.title}”. Agreement here is not proof of a linguistic meaning.`,
    participantId: participant.id,
    payload: { taskId: task.id, outcome: input.outcome },
  });
  return { ok: true };
}

async function taskInSession(sessionId: string, taskId: string) {
  const task = await prisma.communicationTask.findFirst({ where: { id: taskId, sessionId } });
  if (!task) throw new HttpError(404, "That situation is not in this session.");
  return task;
}

export async function impactForSession(code: string, token: string | null) {
  await requireParticipant(code, token);
  const session = await prisma.discoverySession.findUnique({
    where: { code },
    include: { concepts: true, tasks: true, responses: true, experiments: true, events: true },
  });
  if (!session) throw new HttpError(404, "No session uses that code.");
  return summarizeImpact({
    illustrative: session.isIllustrative,
    createdAt: session.createdAt.toISOString(),
    tasks: session.tasks.map((task) => ({ outcome: task.outcome, createdAt: task.createdAt.toISOString() })),
    concepts: session.concepts.filter((concept) => !concept.archivedAt).map((concept) => ({
      status: concept.status,
      updatedAt: concept.updatedAt.toISOString(),
    })),
    lockedResponses: session.responses.filter((item) => item.lockedAt).length,
    experiments: session.experiments.length,
    disagreements: session.events.filter((event) => ["hypothesis.challenged", "hypothesis.rejected", "concept.disputed", "concept.restored"].includes(event.type)).length,
  });
}

export function impactMarkdown(code: string, name: string, summary: ReturnType<typeof summarizeImpact>) {
  const agreement = summary.minutesToFirstAgreement === null ? "No session-verified concept yet." : `${summary.minutesToFirstAgreement} minutes from session start to the latest update on the earliest session-verified concept.`;
  return [
    `# Community record — ${name}`,
    "",
    `Session code: ${code}`,
    "",
    summary.note,
    "",
    `- Communication tasks attempted: ${summary.tasksAttempted}`,
    `- Session-verified concepts: ${summary.sessionVerified}`,
    `- Unresolved concepts: ${summary.unresolved}`,
    `- Independent responses locked: ${summary.independentResponses}`,
    `- Checks recorded: ${summary.experiments}`,
    `- Disagreements or reopenings recorded: ${summary.misunderstandingsCorrected}`,
    `- Repeated attempts: ${summary.repeatedAttempts}`,
    `- Time to session agreement: ${agreement}`,
    "",
    "These numbers are counts from this session. They are not a measure of reduced inequality.",
    "",
  ].join("\n");
}
