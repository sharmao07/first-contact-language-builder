import { prisma } from "@/lib/database/prisma";
import { getSessionByCode } from "@/lib/domain/common";
import { conceptsToCsv, rowsToCsv, toMarkdown, type ReportConcept, type ReportInput } from "@/lib/research/format";

export async function researchSnapshot(code?: string | null) {
  const sessions = await prisma.discoverySession.findMany({
    where: code ? { code: code.toUpperCase() } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      participants: true,
      concepts: { include: { experiments: { include: { responses: true } }, hypotheses: true } },
      evidence: { where: { deletedAt: null } },
      hypotheses: true,
      relationships: { include: { fromConcept: true, toConcept: true } },
      experiments: { include: { responses: true } },
      notes: { include: { concept: true, author: true } },
      events: { orderBy: { createdAt: "desc" }, take: 40, include: { participant: true } },
      activities: { include: { responses: true } },
    },
  });

  const concepts = sessions.flatMap((session) => session.concepts);
  const responses = sessions.flatMap((session) => session.experiments.flatMap((experiment) => experiment.responses));
  const correct = responses.filter((response) => response.result === "correct").length;
  const openHypotheses = sessions.flatMap((session) => session.hypotheses).filter((hypothesis) => hypothesis.status === "open");

  return {
    localNote: "These figures are counts from the database on this computer. They are not published findings.",
    totals: {
      sessions: sessions.length,
      illustrativeSessions: sessions.filter((session) => session.isIllustrative).length,
      concepts: concepts.length,
      verified: concepts.filter((concept) => concept.status === "verified").length,
      disputed: concepts.filter((concept) => concept.status === "disputed").length,
      tentative: concepts.filter((concept) => concept.status === "tentative").length,
      awaiting: concepts.filter((concept) => concept.status === "awaiting" || concept.status === "hypothesis").length,
      reopened: concepts.filter((concept) => concept.status === "reopened").length,
      pendingHypotheses: openHypotheses.length,
      evidence: sessions.reduce((sum, session) => sum + session.evidence.length, 0),
      checks: responses.length,
      correct,
      verificationShare: responses.length ? correct / responses.length : null,
    },
    sessions: sessions.map((session) => ({
      code: session.code,
      name: session.name,
      description: session.description,
      isIllustrative: session.isIllustrative,
      isDemo: session.isDemo,
      updatedAt: session.updatedAt.toISOString(),
      participants: session.participants.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        role: participant.role,
      })),
      counts: {
        concepts: session.concepts.length,
        verified: session.concepts.filter((concept) => concept.status === "verified").length,
        disputed: session.concepts.filter((concept) => concept.status === "disputed").length,
        evidence: session.evidence.length,
      },
    })),
    concepts: sessions.flatMap((session) =>
      session.concepts.map((concept) => ({
        id: concept.id,
        sessionCode: session.code,
        conceptCode: concept.conceptCode,
        agreedMeaning: concept.agreedMeaning,
        category: concept.category,
        status: concept.status,
        statusReason: concept.statusReason,
        aiConfidence: concept.aiConfidence,
        updatedAt: concept.updatedAt.toISOString(),
      })),
    ),
    timeline: sessions
      .flatMap((session) =>
        session.events.map((event) => ({
          id: event.id,
          sessionCode: session.code,
          type: event.type,
          message: event.message,
          actor: event.participant?.displayName ?? null,
          createdAt: event.createdAt.toISOString(),
        })),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 40),
    contributions: contributionRows(sessions),
    activityResponses: sessions.reduce(
      (sum, session) => sum + session.activities.reduce((inner, activity) => inner + activity.responses.length, 0),
      0,
    ),
  };
}

function contributionRows(
  sessions: Array<{
    code: string;
    participants: Array<{ id: string; displayName: string; role: string }>;
    evidence: Array<{ participantId: string }>;
    notes: Array<{ authorParticipantId: string | null }>;
    experiments: Array<{ responses: Array<{ participantId: string }> }>;
    hypotheses: Array<{ createdByParticipantId: string | null; source: string }>;
  }>,
) {
  return sessions.flatMap((session) =>
    session.participants.map((participant) => ({
      sessionCode: session.code,
      participantId: participant.id,
      displayName: participant.displayName,
      role: participant.role,
      evidence: session.evidence.filter((item) => item.participantId === participant.id).length,
      checks: session.experiments.reduce(
        (sum, experiment) => sum + experiment.responses.filter((response) => response.participantId === participant.id).length,
        0,
      ),
      notes: session.notes.filter((note) => note.authorParticipantId === participant.id).length,
      proposals: session.hypotheses.filter((hypothesis) => hypothesis.createdByParticipantId === participant.id).length,
    })),
  );
}

export async function exportResearch(format: "json" | "csv" | "md", code?: string | null, dataset = "concepts") {
  const sessions = await prisma.discoverySession.findMany({
    where: code ? { code: code.toUpperCase() } : undefined,
    include: {
      participants: true,
      concepts: { include: { experiments: { include: { responses: true } } } },
      notes: { include: { concept: true } },
      relationships: { include: { fromConcept: true, toConcept: true } },
      evidence: {
        select: {
          id: true,
          type: true,
          description: true,
          conceptId: true,
          createdAt: true,
          deletedAt: true,
          stance: true,
          consentToAnalyze: true,
          durationMs: true,
          mimeType: true,
          byteSize: true,
        },
      },
      hypotheses: {
        select: {
          id: true,
          proposedMeaning: true,
          source: true,
          status: true,
          simulated: true,
          confidence: true,
          conceptId: true,
          providerNote: true,
          missingInformation: true,
          culturalAmbiguity: true,
          suggestedExperiment: true,
          createdAt: true,
        },
      },
      experiments: { include: { responses: true, concept: true } },
    },
  });
  if (code && !sessions.length) {
    await getSessionByCode(code);
  }
  const report = toReport(sessions);
  if (format === "md") return { body: toMarkdown(report), contentType: "text/markdown; charset=utf-8", filename: "first-contact-report.md" };
  if (format === "csv") {
    return csvDataset(sessions, report, dataset);
  }
  return {
    body: JSON.stringify({ generatedAt: report.generatedAt, sessions: publicSessions(sessions, report) }, null, 2),
    contentType: "application/json; charset=utf-8",
    filename: "first-contact-export.json",
  };
}

function toReport(
  sessions: Array<{
    code: string;
    name: string;
    description: string;
    isIllustrative: boolean;
    participants: Array<{ displayName: string; role: string }>;
    concepts: Array<{
      conceptCode: string;
      agreedMeaning: string;
      category: string;
      status: string;
      statusReason: string;
      alternativeInterpretations: string;
      contextualNotes: string;
      exampleSituations: string;
      aiConfidence: number | null;
      experiments: Array<{ responses: Array<{ result: string }> }>;
    }>;
    notes: Array<{ title: string; body: string; concept: { conceptCode: string } | null }>;
    relationships: Array<{ relationType: string; status: string; fromConcept: { agreedMeaning: string; conceptCode: string }; toConcept: { agreedMeaning: string; conceptCode: string } }>;
  }>,
): ReportInput {
  return {
    generatedAt: new Date().toISOString(),
    sessions: sessions.map((session) => ({
      code: session.code,
      name: session.name,
      illustrative: session.isIllustrative,
      description: session.description,
      participants: session.participants.map((participant) => `${participant.displayName} (${participant.role})`),
      concepts: session.concepts.map((concept) => conceptReport(concept)),
      notes: session.notes.map((note) => ({
        title: note.title,
        body: note.body,
        conceptCode: note.concept?.conceptCode ?? null,
      })),
      relationships: session.relationships.map((relationship) => ({
        from: relationship.fromConcept.agreedMeaning || relationship.fromConcept.conceptCode,
        to: relationship.toConcept.agreedMeaning || relationship.toConcept.conceptCode,
        type: relationship.relationType,
        status: relationship.status,
      })),
    })),
  };
}

function conceptReport(concept: {
  conceptCode: string;
  agreedMeaning: string;
  category: string;
  status: string;
  statusReason: string;
  alternativeInterpretations: string;
  contextualNotes: string;
  exampleSituations: string;
  aiConfidence: number | null;
  experiments: Array<{ responses: Array<{ result: string }> }>;
}): ReportConcept {
  const results = concept.experiments.flatMap((experiment) => experiment.responses.map((response) => response.result));
  return {
    code: concept.conceptCode,
    meaning: concept.agreedMeaning,
    category: concept.category,
    status: concept.status,
    statusReason: concept.statusReason,
    alternatives: concept.alternativeInterpretations,
    notes: concept.contextualNotes,
    examples: concept.exampleSituations,
    aiConfidence: concept.aiConfidence,
    checks: results.length,
    correct: results.filter((result) => result === "correct").length,
    incorrect: results.filter((result) => result === "incorrect").length,
    ambiguous: results.filter((result) => result === "ambiguous").length,
    disagreements: results.filter((result) => result === "disagree").length,
  };
}

function csvDataset(
  sessions: Array<{
    code: string;
    concepts: Array<{ conceptCode: string; id?: string }>;
    evidence: Array<{ id: string; type: string; description: string; conceptId: string | null; createdAt: Date; deletedAt: Date | null; stance: string; consentToAnalyze: boolean; durationMs: number | null; mimeType: string | null; byteSize: number | null }>;
    hypotheses: Array<{ id: string; proposedMeaning: string; source: string; status: string; simulated: boolean; confidence: number; conceptId: string | null; providerNote: string; missingInformation: string; culturalAmbiguity: string; suggestedExperiment: string; createdAt: Date }>;
    relationships: Array<{ relationType: string; status: string; notes?: string; fromConcept: { conceptCode: string }; toConcept: { conceptCode: string } }>;
    experiments: Array<{ id: string; type: string; stimulusKey: string; stimulusVariation: string; concept: { conceptCode: string }; responses: Array<{ result: string; notes: string; createdAt: Date }> }>;
  }>,
  report: ReportInput,
  dataset: string,
) {
  const conceptCode = new Map<string, string>();
  for (const session of sessions) {
    for (const concept of session.concepts) {
      if (concept.id) conceptCode.set(concept.id, concept.conceptCode);
    }
  }
  if (dataset === "hypotheses") {
    const rows = sessions.flatMap((session) =>
      session.hypotheses.map((item) => [
        session.code,
        item.id,
        item.conceptId ? conceptCode.get(item.conceptId) ?? "" : "",
        item.proposedMeaning,
        item.status,
        item.source,
        item.simulated ? "simulated" : "provider",
        item.confidence,
        item.missingInformation,
        item.culturalAmbiguity,
        item.suggestedExperiment,
        item.createdAt.toISOString(),
      ]),
    );
    return file(rowsToCsv(["sessionCode", "hypothesisId", "conceptCode", "meaning", "status", "source", "analysis", "aiEstimatedConfidence", "missingInformation", "culturalAmbiguity", "suggestedExperiment", "createdAt"], rows), "first-contact-hypotheses.csv");
  }
  if (dataset === "evidence") {
    const rows = sessions.flatMap((session) =>
      session.evidence.map((item) => [
        session.code,
        item.id,
        item.type,
        item.stance,
        item.deletedAt ? "deleted" : "stored",
        item.consentToAnalyze ? "yes" : "no",
        item.durationMs ?? "",
        item.mimeType ?? "",
        item.byteSize ?? "",
        item.description,
        item.createdAt.toISOString(),
      ]),
    );
    return file(rowsToCsv(["sessionCode", "evidenceId", "type", "stance", "retention", "consentToAnalyze", "durationMs", "mimeType", "byteSize", "description", "createdAt"], rows), "first-contact-evidence.csv");
  }
  if (dataset === "checks") {
    const rows = sessions.flatMap((session) =>
      session.experiments.flatMap((experiment) =>
        experiment.responses.map((response) => [
          session.code,
          experiment.concept.conceptCode,
          experiment.type,
          experiment.stimulusKey,
          experiment.stimulusVariation,
          response.result,
          response.notes,
          response.createdAt.toISOString(),
        ]),
      ),
    );
    return file(rowsToCsv(["sessionCode", "conceptCode", "experimentType", "stimulusKey", "stimulusVariation", "result", "notes", "createdAt"], rows), "first-contact-checks.csv");
  }
  if (dataset === "relationships") {
    const rows = sessions.flatMap((session) =>
      session.relationships.map((link) => [
        session.code,
        link.fromConcept.conceptCode,
        link.toConcept.conceptCode,
        link.relationType,
        link.status,
        link.notes ?? "",
      ]),
    );
    return file(rowsToCsv(["sessionCode", "from", "to", "relationType", "status", "notes"], rows), "first-contact-relationships.csv");
  }
  const rows = report.sessions.flatMap((session) => session.concepts.map((concept) => ({ ...concept, sessionCode: session.code })));
  return file(conceptsToCsv(rows), "first-contact-concepts.csv");
}

function file(body: string, filename: string) {
  return { body, contentType: "text/csv; charset=utf-8", filename };
}

function publicSessions(
  sessions: Array<{
    code: string;
    name: string;
    description: string;
    isIllustrative: boolean;
    isDemo: boolean;
    status: string;
    createdAt: Date;
    participants: Array<{ displayName: string; role: string }>;
    evidence: Array<{ id: string; type: string; description: string; conceptId: string | null; createdAt: Date }>;
    hypotheses: Array<{ id: string; proposedMeaning: string; source: string; status: string; simulated: boolean; confidence: number; conceptId: string | null; providerNote: string }>;
  }>,
  report: ReportInput,
) {
  return sessions.map((session, index) => ({
    code: session.code,
    name: session.name,
    description: session.description,
    illustrative: session.isIllustrative,
    demo: session.isDemo,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    participants: session.participants.map((participant) => ({ name: participant.displayName, role: participant.role })),
    concepts: report.sessions[index]?.concepts ?? [],
    relationships: report.sessions[index]?.relationships ?? [],
    notes: report.sessions[index]?.notes ?? [],
    evidence: session.evidence.filter((item) => !("deletedAt" in item) || !item.deletedAt).map((item) => ({
      id: item.id,
      type: item.type,
      description: item.description,
      conceptId: item.conceptId,
      stance: "stance" in item ? item.stance : "observation",
      consentToAnalyze: "consentToAnalyze" in item ? item.consentToAnalyze : false,
      durationMs: "durationMs" in item ? item.durationMs : null,
      createdAt: item.createdAt.toISOString(),
      deleted: false,
    })),
    hypotheses: session.hypotheses,
  }));
}
