export type MediaKind = "image" | "drawing" | "audio" | "video" | "gesture" | "note";

export type AnalyzeInput = {
  evidenceType: string;
  description: string;
  notes: string;
  actionCategory: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  mediaBytes?: Buffer | null;
  consentToAnalyze?: boolean;
  durationMs?: number | null;
  qualityNote?: string | null;
  stance?: string | null;
  parentEvidenceId?: string | null;
  gestureDirection?: string | null;
  gestureRepetition?: string | null;
  gestureBody?: string | null;
  knownConcepts: { meaning: string; status: string }[];
};

export type HypothesisDraft = {
  proposedMeaning: string;
  explanation: string;
  supportingEvidence: string;
  alternatives: string;
  missingInformation: string;
  culturalAmbiguity: string;
  confidence: number;
  suggestedExperiment: string;
};

export type AnalysisResult = {
  simulated: boolean;
  providerNote: string;
  observations: string[];
  inferences: string[];
  cannotDetermine: string[];
  ambiguities: string[];
  followUps: string[];
  hypotheses: HypothesisDraft[];
};

export interface AIProvider {
  id: "demo" | "openai";
  analyze(input: AnalyzeInput): Promise<AnalysisResult>;
}
