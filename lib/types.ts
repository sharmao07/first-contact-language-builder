export type AIMode = "demo" | "openai";

export type ParticipantDTO = {
  id: string;
  displayName: string;
  role: string;
  leftAt: string | null;
  lastSeenAt: string;
  connected: boolean;
};

export type ConceptDTO = {
  id: string;
  conceptCode: string;
  agreedMeaning: string;
  category: string;
  status: string;
  statusReason: string;
  contextualNotes: string;
  exampleSituations: string;
  alternativeInterpretations: string;
  aiConfidence: number | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  summary: string;
};

export type EvidenceDTO = {
  id: string;
  participantId: string;
  participantName: string;
  conceptId: string | null;
  type: string;
  mimeType: string | null;
  fileName: string | null;
  byteSize: number | null;
  description: string;
  actionCategory: string | null;
  notes: string;
  stance: string;
  consentToAnalyze: boolean;
  durationMs: number | null;
  qualityNote: string;
  annotation: string;
  parentEvidenceId: string | null;
  gestureDirection: string;
  gestureRepetition: string;
  gestureBody: string;
  mediaUrl: string | null;
  createdAt: string;
};

export type HypothesisDTO = {
  id: string;
  conceptId: string | null;
  evidenceId: string | null;
  proposedMeaning: string;
  explanation: string;
  supportingEvidence: string;
  alternatives: string;
  missingInformation: string;
  culturalAmbiguity: string;
  cannotDetermine: string;
  confidence: number;
  suggestedExperiment: string;
  source: string;
  status: string;
  simulated: boolean;
  providerNote: string;
  createdByParticipantId: string | null;
  createdAt: string;
};

export type RelationshipDTO = {
  id: string;
  fromConceptId: string;
  toConceptId: string;
  relationType: string;
  status: string;
  notes: string;
  createdAt: string;
};

export type ExperimentDTO = {
  id: string;
  conceptId: string;
  type: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
  stimulusKey: string;
  stimulusVariation: string;
  contextNote: string;
  status: string;
  round: number;
  createdAt: string;
  responses: Array<{
    id: string;
    participantId: string;
    participantName: string;
    result: string;
    selectedOptionId: string;
    notes: string;
    createdAt: string;
  }>;
};

export type ActivityDTO = {
  id: string;
  conceptId: string | null;
  type: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
  answerKey: string;
  source: string;
  createdAt: string;
  responses: Array<{
    id: string;
    participantId: string;
    participantName: string;
    correct: boolean | null;
    notes: string;
    clarification: string;
    createdAt: string;
  }>;
};

export type NoteDTO = {
  id: string;
  conceptId: string | null;
  authorParticipantId: string | null;
  authorName: string | null;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type EventDTO = {
  id: string;
  participantId: string | null;
  type: string;
  message: string;
  payload: unknown;
  createdAt: string;
};

export type ExpressionDTO = {
  id: string;
  title: string;
  gloss: string;
  orderNote: string;
  grammarNote: string;
  contextExample: string;
  counterexample: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  conceptIds: string[];
};

export type SessionState = {
  session: {
    id: string;
    code: string;
    name: string;
    description: string;
    objective: string;
    status: string;
    archivedAt: string | null;
    isDemo: boolean;
    isIllustrative: boolean;
    revision: number;
    createdAt: string;
    updatedAt: string;
  };
  viewer: { id: string; role: string; displayName: string } | null;
  participants: ParticipantDTO[];
  concepts: ConceptDTO[];
  evidence: EvidenceDTO[];
  hypotheses: HypothesisDTO[];
  relationships: RelationshipDTO[];
  experiments: ExperimentDTO[];
  activities: ActivityDTO[];
  notes: NoteDTO[];
  events: EventDTO[];
  expressions: ExpressionDTO[];
  ai: { mode: AIMode; disclosure: string };
  counts: {
    established: number;
    pending: number;
    verified: number;
    disputed: number;
    tentative: number;
    evidence: number;
    openHypotheses: number;
  };
};

export type Identity = {
  token: string;
  participantId: string;
  role: string;
  displayName: string;
  code: string;
};
