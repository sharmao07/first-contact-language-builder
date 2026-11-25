import type { Recommendation } from "@/lib/experiments/schema";
import type { EngineSnapshot } from "@/lib/experiments/state";

export type QualityStatus = "pass" | "weak" | "fail";

export type QualityCheck = {
  name: string;
  status: QualityStatus;
  reason: string;
};

export type QualityReport = {
  passed: number;
  weak: boolean;
  checks: QualityCheck[];
  note: string;
};

const LEADING = /correct answer|the right meaning|you should choose|the answer is|verified meaning|must speak english|phoneme|translation equivalent/i;
const COMMON_WORDS = new Set(["about", "after", "again", "being", "could", "other", "their", "there", "these", "thing", "those", "which", "would"]);

function echoesReading(prompt: string, meanings: string[]) {
  const lowered = prompt.toLowerCase();
  return meanings.some((meaning) => {
    if (meaning.length > 3 && lowered.includes(meaning.toLowerCase())) return true;
    return meaning.toLowerCase().split(/[^a-z0-9]+/).some((word) => word.length > 4 && !COMMON_WORDS.has(word) && lowered.includes(word));
  });
}

export function evaluateRecommendation(recommendation: Recommendation, snapshot: EngineSnapshot): QualityReport {
  const used = new Set(snapshot.usedStimuli.map((item) => item.toLowerCase()));
  const usedTypes = new Set(snapshot.usedTypes);
  const meanings = recommendation.competingMeanings;
  const novel = recommendation.stimuli.filter((item) => !used.has(item.toLowerCase()));
  const mapped = recommendation.reviewState !== "draft" && recommendation.outcomes.every((outcome) =>
    meanings.every((meaning) => outcome.expectedUnder.some((cell) => cell.meaning === meaning && cell.expectation.trim() && !cell.expectation.startsWith("No example-specific"))));
  const leading = LEADING.test(`${recommendation.neutralPrompt} ${recommendation.procedure}`);
  const namesMeanings = echoesReading(recommendation.neutralPrompt, meanings);
  const ambiguousOutcome = recommendation.outcomes.some((outcome) => !outcome.distinguishes);
  const checks: QualityCheck[] = [
    {
      name: "Competing-hypothesis coverage",
      status: meanings.length >= 2 && recommendation.outcomes.some((outcome) => outcome.distinguishes) ? "pass" : "fail",
      reason: meanings.length >= 2
        ? "The check names more than one reading and has an outcome that would separate them."
        : "Fewer than two readings are named, so the check cannot separate interpretations.",
    },
    {
      name: "Stimulus novelty",
      status: novel.length === recommendation.stimuli.length ? "pass" : novel.length > 0 ? "weak" : "fail",
      reason: novel.length === recommendation.stimuli.length
        ? "None of these stimuli are already on record."
        : novel.length > 0
          ? "Some stimuli repeat an earlier example."
          : "Every stimulus repeats an example already used.",
    },
    {
      name: "Independence from previous checks",
      status: !usedTypes.has(recommendation.experimentType) || novel.length > 0 ? "pass" : "weak",
      reason: usedTypes.has(recommendation.experimentType) && novel.length === 0
        ? "This repeats both the earlier check type and its stimulus."
        : "The check changes the type or the stimulus, so it is not the same test again.",
    },
    {
      name: "Neutrality of instructions",
      status: leading ? "fail" : namesMeanings ? "weak" : "pass",
      reason: leading
        ? "The instruction uses a leading phrase, such as telling the person the correct answer."
        : namesMeanings
          ? "The instruction repeats words from a reading. Confirm it does not point to the expected answer."
          : "The instruction tells the person what to do without naming the expected reading.",
    },
    {
      name: "Outcome mapping completeness",
      status: mapped && recommendation.outcomes.every((outcome) => outcome.supports.trim() && outcome.weakens.trim()) ? "pass" : "fail",
      reason: recommendation.reviewState === "draft"
        ? "Draft. A facilitator needs to review this. The expectations are not tied to each example."
        : mapped
          ? "Each outcome names the example it predicts for every reading."
          : "At least one outcome does not say what every named reading would predict.",
    },
    {
      name: "Feasibility",
      status: recommendation.stimuli.length > 0 && recommendation.procedure.trim() ? "pass" : "fail",
      reason: recommendation.stimuli.length > 0 && recommendation.procedure.trim()
        ? "The procedure can be done with the listed examples or a live demonstration."
        : "The check does not say what to show or how to show it.",
    },
    {
      name: "Participant accessibility",
      status: recommendation.neutralPrompt.length <= 500 && !LEADING.test(recommendation.neutralPrompt) ? "pass" : "weak",
      reason: recommendation.neutralPrompt.length <= 500
        ? "The instruction is short enough to follow without specialist language."
        : "The instruction is long or uses specialist language.",
    },
    {
      name: "Preservation of ambiguity",
      status: ambiguousOutcome && recommendation.remainingAmbiguity.trim() ? "pass" : "weak",
      reason: ambiguousOutcome
        ? "At least one outcome leaves the reading unresolved. The score is not a probability."
        : "Every listed outcome is treated as decisive. The check should keep an unresolved result.",
    },
  ];
  const passed = checks.filter((item) => item.status === "pass").length;
  const weak = checks.some((item) => item.status !== "pass");
  return {
    passed,
    weak,
    checks,
    note: `${passed} of 8 checklist checks passed. ${weak ? "This recommendation is weak. " : ""}Not a probability and not information gain.`,
  };
}
