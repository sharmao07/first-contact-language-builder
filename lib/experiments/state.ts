export type EngineHypothesis = {
  id: string;
  meaning: string;
  status: string;
  explanation: string;
  supporting: string;
  alternatives: string;
  missing: string;
  ambiguity: string;
  evidenceId: string | null;
  conceptId: string | null;
  simulated: boolean;
};

export type EngineEvidence = {
  id: string;
  type: string;
  description: string;
  notes: string;
  annotation: string;
  stance: string;
  actionCategory: string | null;
  consentToAnalyze?: boolean;
  omitted?: boolean;
};

export type EngineExperiment = {
  type: string;
  stimulusKey: string;
  stimulusVariation: string;
  results: string[];
};

export type EngineSnapshot = {
  hypotheses: EngineHypothesis[];
  evidence: EngineEvidence[];
  concepts: Array<{ id: string; meaning: string; status: string; alternatives: string }>;
  experiments: EngineExperiment[];
  readings: string[];
  usedStimuli: string[];
  usedTypes: string[];
};

const ACTIVE = new Set(["open", "accepted", "challenged", "hypothesis", "tentative", "awaiting", "reopened"]);

export function activeHypotheses(snapshot: EngineSnapshot) {
  return snapshot.hypotheses.filter((item) => item.meaning.trim() && item.status !== "rejected" && item.status !== "archived" && (ACTIVE.has(item.status) || item.status === "open"));
}

export function competingMeanings(snapshot: EngineSnapshot) {
  const fromHypotheses = activeHypotheses(snapshot).map((item) => item.meaning.trim());
  const fromReadings = snapshot.readings.map((item) => item.trim()).filter(Boolean);
  const seen = new Set<string>();
  const meanings: string[] = [];
  for (const meaning of [...fromHypotheses, ...fromReadings]) {
    const key = meaning.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    meanings.push(meaning);
  }
  return meanings.slice(0, 4);
}
