import { buildRulePlan } from "@/lib/experiments/select";
import { evaluateRecommendation } from "@/lib/experiments/quality";
import type { EngineHypothesis, EngineSnapshot } from "@/lib/experiments/state";

export type BenchmarkScenario = {
  id: string;
  ambiguity: string;
  snapshot: EngineSnapshot;
};

function reading(id: string, meaning: string, evidenceId = "e1"): EngineHypothesis {
  return {
    id,
    meaning,
    status: "open",
    explanation: "A reading already written in the session.",
    supporting: "A participant wrote this reading.",
    alternatives: "Another reading is still possible.",
    missing: "The two readings have not been shown apart.",
    ambiguity: "The same example can fit more than one reading.",
    evidenceId,
    conceptId: null,
    simulated: true,
  };
}

function scene(description: string, type = "image", extra: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    hypotheses: extra.hypotheses ?? [],
    evidence: [{
      id: "e1",
      type,
      description,
      notes: "",
      annotation: "",
      stance: "observation",
      actionCategory: null,
      consentToAnalyze: true,
    }],
    concepts: [],
    experiments: extra.experiments ?? [],
    readings: extra.readings ?? [],
    usedStimuli: extra.usedStimuli ?? [],
    usedTypes: extra.usedTypes ?? [],
  };
}

export const BENCHMARK: BenchmarkScenario[] = [
  { id: "object-substance", ambiguity: "Object versus substance", snapshot: scene("A glass of water is held up.", "image", { hypotheses: [reading("a", "The container"), reading("b", "Water, the substance")] }) },
  { id: "action-object", ambiguity: "Action versus object", snapshot: scene("A hand lifts a cup to the mouth.", "gesture", { hypotheses: [reading("a", "The action of drinking"), reading("b", "The cup")] }) },
  { id: "direction-destination", ambiguity: "Direction versus destination", snapshot: scene("A point toward the path on the left.", "gesture", { hypotheses: [reading("a", "Direction left"), reading("b", "That destination")] }) },
  { id: "possession-ownership", ambiguity: "Possession versus ownership", snapshot: scene("A hand rests on a bag.", "image", { hypotheses: [reading("a", "Holding it now"), reading("b", "It belongs to someone")] }) },
  { id: "person-relationship", ambiguity: "Person versus relationship", snapshot: scene("Two people stand together, one slightly ahead.", "image", { hypotheses: [reading("a", "That person"), reading("b", "A family relationship")] }) },
  { id: "quantity-intensity", ambiguity: "Quantity versus intensity", snapshot: scene("Several marks, drawn darker toward the end.", "drawing", { hypotheses: [reading("a", "A larger quantity"), reading("b", "A stronger intensity")] }) },
  { id: "gesture-action", ambiguity: "Gesture versus action", snapshot: scene("An open hand moves toward another person.", "gesture", { hypotheses: [reading("a", "A greeting gesture"), reading("b", "The action of giving")] }) },
  { id: "sound-noise", ambiguity: "Sound versus environmental noise", snapshot: scene("A short recording with a voice and rain.", "audio", { hypotheses: [reading("a", "A spoken sound"), reading("b", "The surrounding noise")] }) },
  { id: "request-name", ambiguity: "Request versus a name", snapshot: scene("The same glass is offered, then pointed at.", "image", { hypotheses: [reading("a", "A request for a drink"), reading("b", "The name of the object")] }) },
  { id: "place-object", ambiguity: "Place versus object", snapshot: scene("A tree is used as the place where people meet.", "image", { hypotheses: [reading("a", "The tree"), reading("b", "The meeting place")] }) },
  { id: "single-reading", ambiguity: "Too little to separate", snapshot: scene("One gesture with one written reading.", "gesture", { hypotheses: [reading("a", "A single reading")] }) },
  { id: "repeated-stimulus", ambiguity: "A stimulus already used", snapshot: scene("A glass of water is held up.", "image", { hypotheses: [reading("a", "The container"), reading("b", "Water, the substance")], usedStimuli: ["the holder, shown empty", "the same holder with liquid", "the drinking motion with empty hands"], usedTypes: ["visual_discrimination"] }) },
];

export function runStructuralBenchmark() {
  return BENCHMARK.map((scenario) => {
    const plan = buildRulePlan(scenario.snapshot);
    const reports = plan.recommendations.map((item) => evaluateRecommendation(item, scenario.snapshot));
    const novel = plan.recommendations.some((item) =>
      item.stimuli.some((stimulus) => !scenario.snapshot.usedStimuli.map((used) => used.toLowerCase()).includes(stimulus.toLowerCase())));
    return {
      id: scenario.id,
      ambiguity: scenario.ambiguity,
      sufficient: plan.sufficient,
      recommendationCount: plan.recommendations.length,
      distinguishes: plan.sufficient && novel,
      weak: reports.some((report) => report.weak),
      bestPassed: reports.reduce((best, report) => Math.max(best, report.passed), 0),
    };
  });
}
