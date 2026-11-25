-- Initial PostgreSQL schema. Apply with prisma migrate deploy against an empty database.
-- This file creates tables. It does not delete rows and it must not be used with migrate reset.
-- CreateTable
CREATE TABLE "DiscoverySession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "objective" TEXT NOT NULL DEFAULT '',
    "purpose" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'active',
    "archivedAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "isIllustrative" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "communityRole" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "conceptId" TEXT,
    "type" TEXT NOT NULL,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "fileName" TEXT,
    "byteSize" INTEGER,
    "description" TEXT NOT NULL DEFAULT '',
    "actionCategory" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "stance" TEXT NOT NULL DEFAULT 'observation',
    "consentToAnalyze" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "qualityNote" TEXT NOT NULL DEFAULT '',
    "annotation" TEXT NOT NULL DEFAULT '',
    "parentEvidenceId" TEXT,
    "gestureDirection" TEXT NOT NULL DEFAULT '',
    "gestureRepetition" TEXT NOT NULL DEFAULT '',
    "gestureBody" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conceptCode" TEXT NOT NULL,
    "agreedMeaning" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'other',
    "status" TEXT NOT NULL DEFAULT 'hypothesis',
    "statusReason" TEXT NOT NULL DEFAULT '',
    "contextualNotes" TEXT NOT NULL DEFAULT '',
    "exampleSituations" TEXT NOT NULL DEFAULT '',
    "alternativeInterpretations" TEXT NOT NULL DEFAULT '',
    "aiConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyEntry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabularyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptHypothesis" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conceptId" TEXT,
    "evidenceId" TEXT,
    "proposedMeaning" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "supportingEvidence" TEXT NOT NULL,
    "alternatives" TEXT NOT NULL,
    "missingInformation" TEXT NOT NULL DEFAULT '',
    "culturalAmbiguity" TEXT NOT NULL DEFAULT '',
    "cannotDetermine" TEXT NOT NULL DEFAULT '',
    "confidence" DOUBLE PRECISION NOT NULL,
    "suggestedExperiment" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "providerNote" TEXT NOT NULL DEFAULT '',
    "createdByParticipantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptHypothesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptRelationship" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromConceptId" TEXT NOT NULL,
    "toConceptId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'hypothesis',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationExperiment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL DEFAULT '[]',
    "stimulusKey" TEXT NOT NULL DEFAULT '',
    "stimulusVariation" TEXT NOT NULL DEFAULT '',
    "contextNote" TEXT NOT NULL DEFAULT '',
    "proposalId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationResponse" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningActivity" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conceptId" TEXT,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL DEFAULT '[]',
    "answerKey" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityResponse" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "correct" BOOLEAN,
    "responseJson" TEXT NOT NULL DEFAULT '{}',
    "clarification" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conceptId" TEXT,
    "authorParticipantId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expression" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "gloss" TEXT NOT NULL DEFAULT '',
    "orderNote" TEXT NOT NULL DEFAULT '',
    "grammarNote" TEXT NOT NULL DEFAULT '',
    "contextExample" TEXT NOT NULL DEFAULT '',
    "counterexample" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'hypothesis',
    "shownAt" TIMESTAMP(3),
    "comprehension" TEXT NOT NULL DEFAULT '',
    "comprehensionNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpressionConcept" (
    "id" TEXT NOT NULL,
    "expressionId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ExpressionConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTask" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'show',
    "shownNote" TEXT NOT NULL DEFAULT '',
    "ambiguityNote" TEXT NOT NULL DEFAULT '',
    "outcome" TEXT NOT NULL DEFAULT '',
    "outcomeNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndependentResponse" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorParticipantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'interpretation',
    "body" TEXT NOT NULL DEFAULT '',
    "storagePath" TEXT,
    "mimeType" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndependentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentProposal" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "taskId" TEXT,
    "distinguishes" TEXT NOT NULL DEFAULT '',
    "missing" TEXT NOT NULL DEFAULT '',
    "rationale" TEXT NOT NULL,
    "experimentType" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "outcomesJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "source" TEXT NOT NULL DEFAULT 'rules',
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "disclaimer" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "researchQuestion" TEXT NOT NULL DEFAULT '',
    "competingIdsJson" TEXT NOT NULL DEFAULT '[]',
    "stimuliJson" TEXT NOT NULL DEFAULT '[]',
    "procedure" TEXT NOT NULL DEFAULT '',
    "remainingAmbiguity" TEXT NOT NULL DEFAULT '',
    "limitations" TEXT NOT NULL DEFAULT '',
    "evidenceRefsJson" TEXT NOT NULL DEFAULT '[]',
    "usefulness" TEXT NOT NULL DEFAULT '',
    "heuristicNote" TEXT NOT NULL DEFAULT '',
    "heuristicScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "planJson" TEXT NOT NULL DEFAULT '{}',
    "providerNote" TEXT NOT NULL DEFAULT '',
    "repliesJson" TEXT NOT NULL DEFAULT '[]',
    "recordedOutcome" TEXT NOT NULL DEFAULT '',
    "outcomeReviewJson" TEXT NOT NULL DEFAULT '{}',
    "approvedByParticipantId" TEXT,
    "createdExperimentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverySession_code_key" ON "DiscoverySession"("code");

-- CreateIndex
CREATE INDEX "DiscoverySession_status_idx" ON "DiscoverySession"("status");

-- CreateIndex
CREATE INDEX "DiscoverySession_isDemo_idx" ON "DiscoverySession"("isDemo");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_token_key" ON "Participant"("token");

-- CreateIndex
CREATE INDEX "Participant_sessionId_idx" ON "Participant"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_sessionId_role_key" ON "Participant"("sessionId", "role");

-- CreateIndex
CREATE INDEX "Evidence_sessionId_idx" ON "Evidence"("sessionId");

-- CreateIndex
CREATE INDEX "Evidence_conceptId_idx" ON "Evidence"("conceptId");

-- CreateIndex
CREATE INDEX "Evidence_participantId_idx" ON "Evidence"("participantId");

-- CreateIndex
CREATE INDEX "Concept_sessionId_status_idx" ON "Concept"("sessionId", "status");

-- CreateIndex
CREATE INDEX "Concept_sessionId_category_idx" ON "Concept"("sessionId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Concept_sessionId_conceptCode_key" ON "Concept"("sessionId", "conceptCode");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyEntry_conceptId_key" ON "VocabularyEntry"("conceptId");

-- CreateIndex
CREATE INDEX "VocabularyEntry_sessionId_idx" ON "VocabularyEntry"("sessionId");

-- CreateIndex
CREATE INDEX "ConceptHypothesis_sessionId_idx" ON "ConceptHypothesis"("sessionId");

-- CreateIndex
CREATE INDEX "ConceptHypothesis_conceptId_idx" ON "ConceptHypothesis"("conceptId");

-- CreateIndex
CREATE INDEX "ConceptHypothesis_evidenceId_idx" ON "ConceptHypothesis"("evidenceId");

-- CreateIndex
CREATE INDEX "ConceptRelationship_sessionId_idx" ON "ConceptRelationship"("sessionId");

-- CreateIndex
CREATE INDEX "ConceptRelationship_fromConceptId_idx" ON "ConceptRelationship"("fromConceptId");

-- CreateIndex
CREATE INDEX "ConceptRelationship_toConceptId_idx" ON "ConceptRelationship"("toConceptId");

-- CreateIndex
CREATE INDEX "VerificationExperiment_sessionId_idx" ON "VerificationExperiment"("sessionId");

-- CreateIndex
CREATE INDEX "VerificationExperiment_conceptId_idx" ON "VerificationExperiment"("conceptId");

-- CreateIndex
CREATE INDEX "VerificationResponse_experimentId_idx" ON "VerificationResponse"("experimentId");

-- CreateIndex
CREATE INDEX "VerificationResponse_sessionId_idx" ON "VerificationResponse"("sessionId");

-- CreateIndex
CREATE INDEX "LearningActivity_sessionId_idx" ON "LearningActivity"("sessionId");

-- CreateIndex
CREATE INDEX "LearningActivity_conceptId_idx" ON "LearningActivity"("conceptId");

-- CreateIndex
CREATE INDEX "ActivityResponse_activityId_idx" ON "ActivityResponse"("activityId");

-- CreateIndex
CREATE INDEX "ActivityResponse_participantId_idx" ON "ActivityResponse"("participantId");

-- CreateIndex
CREATE INDEX "ResearchNote_sessionId_idx" ON "ResearchNote"("sessionId");

-- CreateIndex
CREATE INDEX "ResearchNote_conceptId_idx" ON "ResearchNote"("conceptId");

-- CreateIndex
CREATE INDEX "SessionEvent_sessionId_createdAt_idx" ON "SessionEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Expression_sessionId_idx" ON "Expression"("sessionId");

-- CreateIndex
CREATE INDEX "ExpressionConcept_expressionId_idx" ON "ExpressionConcept"("expressionId");

-- CreateIndex
CREATE INDEX "ExpressionConcept_conceptId_idx" ON "ExpressionConcept"("conceptId");

-- CreateIndex
CREATE INDEX "CommunicationTask_sessionId_idx" ON "CommunicationTask"("sessionId");

-- CreateIndex
CREATE INDEX "IndependentResponse_sessionId_idx" ON "IndependentResponse"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "IndependentResponse_taskId_authorParticipantId_key" ON "IndependentResponse"("taskId", "authorParticipantId");

-- CreateIndex
CREATE INDEX "ExperimentProposal_sessionId_idx" ON "ExperimentProposal"("sessionId");

-- CreateIndex
CREATE INDEX "ExperimentProposal_taskId_idx" ON "ExperimentProposal"("taskId");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyEntry" ADD CONSTRAINT "VocabularyEntry_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptHypothesis" ADD CONSTRAINT "ConceptHypothesis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptHypothesis" ADD CONSTRAINT "ConceptHypothesis_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptHypothesis" ADD CONSTRAINT "ConceptHypothesis_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptHypothesis" ADD CONSTRAINT "ConceptHypothesis_createdByParticipantId_fkey" FOREIGN KEY ("createdByParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptRelationship" ADD CONSTRAINT "ConceptRelationship_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptRelationship" ADD CONSTRAINT "ConceptRelationship_fromConceptId_fkey" FOREIGN KEY ("fromConceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptRelationship" ADD CONSTRAINT "ConceptRelationship_toConceptId_fkey" FOREIGN KEY ("toConceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationExperiment" ADD CONSTRAINT "VerificationExperiment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationExperiment" ADD CONSTRAINT "VerificationExperiment_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationResponse" ADD CONSTRAINT "VerificationResponse_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "VerificationExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationResponse" ADD CONSTRAINT "VerificationResponse_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResponse" ADD CONSTRAINT "ActivityResponse_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "LearningActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResponse" ADD CONSTRAINT "ActivityResponse_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_authorParticipantId_fkey" FOREIGN KEY ("authorParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expression" ADD CONSTRAINT "Expression_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpressionConcept" ADD CONSTRAINT "ExpressionConcept_expressionId_fkey" FOREIGN KEY ("expressionId") REFERENCES "Expression"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpressionConcept" ADD CONSTRAINT "ExpressionConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationTask" ADD CONSTRAINT "CommunicationTask_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndependentResponse" ADD CONSTRAINT "IndependentResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndependentResponse" ADD CONSTRAINT "IndependentResponse_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CommunicationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndependentResponse" ADD CONSTRAINT "IndependentResponse_authorParticipantId_fkey" FOREIGN KEY ("authorParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentProposal" ADD CONSTRAINT "ExperimentProposal_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentProposal" ADD CONSTRAINT "ExperimentProposal_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CommunicationTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AccessCredential" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessCredential_tokenHash_key" ON "AccessCredential"("tokenHash");

-- CreateIndex
CREATE INDEX "AccessCredential_participantId_idx" ON "AccessCredential"("participantId");

-- AddForeignKey
ALTER TABLE "AccessCredential" ADD CONSTRAINT "AccessCredential_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

