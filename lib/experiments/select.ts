import { EXPERIMENT_LABEL } from "@/lib/constants";
import {
  CHECKLIST_MEASURES,
  INSPECTION_NOTE,
  SIMULATED_PLAN_NOTE,
  experimentPlanSchema,
  type ExperimentPlan,
  type Recommendation,
} from "@/lib/experiments/schema";
import { bindContrasts, DRAFT_LIMIT, type StimulusContrast } from "@/lib/experiments/outcomes";
import { activeHypotheses, competingMeanings, type EngineSnapshot } from "@/lib/experiments/state";

type Candidate = {
  experimentType: Recommendation["experimentType"];
  title: string;
  stimuli: string[];
  procedure: string;
  usefulness: string;
  contrasts?: StimulusContrast[];
};

function tokens(value: string) {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
}

function clip(value: string, max = 220) {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export function analyzeSnapshot(snapshot: EngineSnapshot) {
  const hypotheses = activeHypotheses(snapshot).slice(0, 6);
  const analyses = hypotheses.map((hypothesis) => {
    const linked = snapshot.evidence.filter((item) => item.id === hypothesis.evidenceId || (hypothesis.conceptId && snapshot.concepts.some((concept) => concept.id === hypothesis.conceptId)));
    const supporting = [hypothesis.supporting, ...linked.filter((item) => item.stance !== "contradictory").map((item) => item.description || item.notes)]
      .map((item) => clip(item))
      .filter(Boolean)
      .slice(0, 4);
    const contradictory = [
      ...snapshot.evidence.filter((item) => item.stance === "contradictory" && (item.id === hypothesis.evidenceId || item.annotation.toLowerCase().includes(hypothesis.meaning.toLowerCase()))).map((item) => clip(item.description || item.notes || item.annotation)),
      ...snapshot.experiments.filter((item) => item.results.includes("disagree")).map(() => "A recorded check includes a disagreement."),
    ].filter(Boolean).slice(0, 4);
    const missing = hypothesis.missing.trim() || "No separate example of this reading is on record.";
    return {
      id: hypothesis.id,
      meaning: hypothesis.meaning,
      status: hypothesis.status,
      supporting: supporting.length ? supporting : ["No supporting observation is written down yet."],
      contradictory,
      missing,
      ambiguity: hypothesis.ambiguity.trim() || hypothesis.alternatives.trim() || "The same evidence may fit more than one reading.",
      distinguishing: "A useful check shows one part of this reading without the part that belongs only to another reading.",
      needsInput: !hypothesis.supporting.trim() || !snapshot.evidence.length,
    };
  });

  const overlaps: ExperimentPlan["overlaps"] = [];
  for (let left = 0; left < analyses.length; left += 1) {
    for (let right = left + 1; right < analyses.length; right += 1) {
      const a = tokens(analyses[left].meaning);
      const b = tokens(analyses[right].meaning);
      const shared = [...a].filter((word) => b.has(word));
      const smaller = Math.min(a.size, b.size) || 1;
      if (shared.length >= 1 && shared.length / smaller >= 0.5) {
        overlaps.push({
          meanings: [analyses[left].meaning, analyses[right].meaning],
          reason: "These readings share wording. They were not merged. A check still has to show whether people treat them as the same idea.",
        });
      }
    }
  }
  return { analyses, overlaps: overlaps.slice(0, 4) };
}

function themeOf(snapshot: EngineSnapshot) {
  const blob = [
    ...snapshot.hypotheses.map((item) => item.meaning),
    ...snapshot.evidence.map((item) => `${item.description} ${item.notes} ${item.actionCategory ?? ""} ${item.type}`),
    ...snapshot.readings,
  ].join(" ").toLowerCase();
  if (/water|drink|cup|glass|container|liquid/.test(blob)) return "water";
  if (/place|direction|left|right|here|there|path/.test(blob)) return "place";
  if (snapshot.evidence.some((item) => item.type === "audio")) return "audio";
  if (snapshot.evidence.some((item) => item.type === "gesture")) return "gesture";
  return "general";
}

function candidatesFor(snapshot: EngineSnapshot): Candidate[] {
  const theme = themeOf(snapshot);
  const hasImage = snapshot.evidence.some((item) => item.type === "image" || item.type === "drawing" || item.type === "video");
  const base: Candidate[] = [];
  if (theme === "water") {
    base.push(
      {
        experimentType: "visual_discrimination",
        title: "Separate the liquid, the container, and the motion",
        stimuli: ["the holder, shown empty", "the same holder with liquid", "the drinking motion with empty hands"],
        contrasts: [
          { stimulus: "the holder, shown empty", tags: ["object"] },
          { stimulus: "the same holder with liquid", tags: ["substance"] },
          { stimulus: "the drinking motion with empty hands", tags: ["action"] },
        ],
        procedure: "Show the three examples one at a time. Pause after each so the other person can answer before seeing the next.",
        usefulness: "These three examples pull apart a substance, an object, and an action when a single scene contains all three.",
      },
      {
        experimentType: "object_substitution",
        title: "Replace the object and keep the place",
        stimuli: ["the original object", "a different object in the same place"],
        procedure: "Keep the gesture and the place. Change only the object.",
        usefulness: "If the reading is the object, the second example should fail. If the reading is the place or the action, it may still match.",
      },
      {
        experimentType: "action_demonstration",
        title: "Show the action with nothing in the hands",
        stimuli: ["the action with nothing held"],
        procedure: "Repeat only the motion. Leave the container out of view.",
        usefulness: "An action reading can survive without the object. An object reading should not.",
      },
    );
  } else if (theme === "place") {
    base.push(
      {
        experimentType: "context_testing",
        title: "Point from here, then move without pointing",
        stimuli: ["a point toward the path, without arriving", "standing at the destination, without pointing"],
        contrasts: [
          { stimulus: "a point toward the path, without arriving", tags: ["direction"] },
          { stimulus: "standing at the destination, without pointing", tags: ["place"] },
        ],
        procedure: "Do the point first. Then walk without pointing. Ask which moment matches.",
        usefulness: "A place or direction can match the point while a movement reading matches the walk.",
      },
      {
        experimentType: "reverse_demonstration",
        title: "Let the other person lead the next example",
        stimuli: ["a demonstration chosen by the other person"],
        procedure: "The person who did not go first shows what they think was meant, without being told a preferred reading.",
        usefulness: "Their own example shows which part they treated as the meaning.",
      },
    );
  } else if (theme === "audio") {
    base.push({
      experimentType: "audio_matching",
      title: "Play the stored sound beside a new one",
      stimuli: ["the stored recording", "a different sound"],
      contrasts: [
        { stimulus: "the stored recording", tags: ["sound"] },
        { stimulus: "a different sound", tags: ["noise"] },
      ],
      procedure: "Play each sound once. Ask whether it matches the earlier expression. Do not transcribe it.",
      usefulness: "A match to only one sound weakens a reading that needed the other.",
    });
  } else if (theme === "gesture") {
    base.push({
      experimentType: "gesture_reproduction",
      title: "Ask for the gesture without copying it exactly",
      stimuli: ["the other person's own version of the gesture"],
      procedure: "Ask them to show the idea again in their own way, then once with one motion left out.",
      usefulness: "The part they keep is the part they are treating as meaningful.",
    });
  }
  if (hasImage || theme === "general") {
    base.push({
      experimentType: "contrast_testing",
      title: "Show one part, then change that part",
      stimuli: ["one part of the earlier example, shown alone", "the same scene with that part changed"],
      procedure: "Show the unchanged part first. Then show the changed scene. Ask after each one.",
      usefulness: "A reading that depends on the changed part should fail on the second example.",
    });
  }
  base.push(
    {
      experimentType: "participant_led",
      title: "Let the other person choose the next example",
      stimuli: ["an example chosen by the other person"],
      procedure: "Ask them to show what they think was meant. Do not hand them the expected answer.",
      usefulness: "Their choice reveals which reading they are using, without a leading question.",
    },
    {
      experimentType: "counterexample",
      title: "Offer a case that should fail for one reading",
      stimuli: ["a case that fits only one of the readings"],
      procedure: "Show a case that one reading accepts and another should reject. Record whether people agree.",
      usefulness: "A shared rejection weakens the reading that predicted a match.",
    },
    {
      experimentType: "repeated_verification",
      title: "Repeat the question with a new example",
      stimuli: ["a new example that was not used in an earlier check"],
      procedure: "Use a different object, place, or motion from the last check. Say what is different before you start.",
      usefulness: "A second stimulus keeps the same question from being counted twice.",
    },
  );
  const seen = new Set<string>();
  return base.filter((item) => {
    if (seen.has(item.experimentType)) return false;
    seen.add(item.experimentType);
    return true;
  });
}

function scoreOf(candidate: Candidate, usedTypes: Set<string>, usedStimuli: Set<string>) {
  let score = 2;
  const novel = candidate.stimuli.some((item) => !usedStimuli.has(item.toLowerCase()));
  if (novel) score += 1;
  if (!usedTypes.has(candidate.experimentType)) score += 1;
  score += 1;
  if (usedTypes.has(candidate.experimentType) && !novel) score -= 2;
  return score;
}

function recommendationFrom(candidate: Candidate, snapshot: EngineSnapshot, meanings: string[], score: number): Recommendation {
  const hypotheses = activeHypotheses(snapshot).slice(0, 4);
  const refs = snapshot.evidence.map((item) => item.id).slice(0, 8);
  const bound = candidate.contrasts ? bindContrasts(meanings, candidate.contrasts) : null;
  const ready = Boolean(bound && bound.length === meanings.length && bound.length >= 2);
  const baseLimit = refs.length
    ? `${EXPERIMENT_LABEL[candidate.experimentType] ?? candidate.experimentType} uses the written record. The file bytes were not inspected. One result is not session verification.`
    : "No stored evidence was available, so this check depends on a live demonstration. One result is not session verification.";
  const outcomes = ready && bound
    ? [
        specificOutcome(bound[0], bound.slice(1)),
        specificOutcome(bound[1], [bound[0], ...bound.slice(2)]),
        {
          outcome: "The answers disagree, more than one example matches, or someone is unsure.",
          expectedUnder: meanings.map((meaning) => ({
            meaning,
            expectation: `“${meaning}” stays unresolved. No single example settled it.`,
          })),
          supports: "Keeping more than one reading open.",
          weakens: "Recording a session-verified meaning from this check alone.",
          distinguishes: false,
          remainingAmbiguity: "Disagreement or an unexpected pattern means this check did not settle the expression.",
        },
      ]
    : [
        {
          outcome: "The facilitator has not confirmed what each example would show.",
          expectedUnder: meanings.map((meaning) => ({
            meaning,
            expectation: `No example-specific prediction is available for “${clip(meaning, 80)}”.`,
          })),
          supports: "Only a later review can say which reading an answer would support.",
          weakens: "Treating this draft as a distinguishing experiment.",
          distinguishes: false,
          remainingAmbiguity: "Without a prediction for each example, an answer cannot be mapped to a reading.",
        },
        {
          outcome: "The answers disagree, or someone is unsure.",
          expectedUnder: meanings.map((meaning) => ({
            meaning,
            expectation: `“${clip(meaning, 80)}” stays unresolved.`,
          })),
          supports: "Keeping more than one reading open.",
          weakens: "Recording a session-verified meaning from this check alone.",
          distinguishes: false,
          remainingAmbiguity: "Disagreement is not a completed mapping.",
        },
      ];
  return {
    title: candidate.title,
    researchQuestion: clip(`Which of these readings, if any, still fits when the examples change: ${meanings.join("; ")}?`, 380),
    competingMeanings: meanings,
    hypothesisIds: hypotheses.map((item) => item.id).slice(0, 8),
    experimentType: candidate.experimentType,
    stimuli: candidate.stimuli,
    procedure: candidate.procedure,
    neutralPrompt: `Show these one at a time: ${candidate.stimuli.join("; ")}. After each, say whether it matches the earlier expression, whether it does not, or whether you are unsure.`,
    outcomes,
    remainingAmbiguity: ready
      ? "A match on one example can weaken another reading. It cannot by itself establish what the expression means."
      : "This draft does not say which example each reading predicts.",
    usefulness: candidate.usefulness,
    limitations: clip(ready ? baseLimit : `${DRAFT_LIMIT} ${baseLimit}`, 500),
    evidenceRefs: refs,
    rationale: clip(`The open readings are ${meanings.join("; ")}. ${candidate.usefulness} Checklist score: ${score}.`, 700),
    heuristic: { score, measures: CHECKLIST_MEASURES },
    reviewState: ready ? "ready" : "draft",
  };
}

function specificOutcome(matched: { meaning: string; stimulus: string }, others: Array<{ meaning: string; stimulus: string }>) {
  const other = others[0];
  return {
    outcome: clip(`Only “${matched.stimulus}” matches.`, 300),
    expectedUnder: [
      { meaning: matched.meaning, expectation: clip(`This reading predicts a match for “${matched.stimulus}”.`, 300) },
      ...others.map((item) => ({
        meaning: item.meaning,
        expectation: clip(`This reading does not predict a match for “${matched.stimulus}”. It predicts “${item.stimulus}”.`, 300),
      })),
    ],
    supports: clip(`The reading “${matched.meaning}”, because “${matched.stimulus}” is the example tied to it.`, 280),
    weakens: clip(other ? `The reading “${other.meaning}”, which predicted “${other.stimulus}” instead.` : "A reading that predicted a different example.", 280),
    distinguishes: true,
    remainingAmbiguity: "One matching example does not show whether the expression was a name, a request, or a description.",
  };
}

export function buildRulePlan(snapshot: EngineSnapshot): ExperimentPlan {
  const { analyses, overlaps } = analyzeSnapshot(snapshot);
  const meanings = competingMeanings(snapshot).slice(0, 3);
  const base = {
    simulated: true,
    source: "rules" as const,
    providerNote: SIMULATED_PLAN_NOTE,
    inspection: INSPECTION_NOTE,
    analyses,
    overlaps,
  };
  if (meanings.length < 2) {
    return experimentPlanSchema.parse({
      ...base,
      sufficient: false,
      insufficientReason: meanings.length === 0
        ? "There is no reading to test yet. Add evidence and at least two interpretations before asking for a check."
        : "One reading is not enough to design a distinguishing check. Add the other person's interpretation, or another hypothesis, instead of treating this one as the meaning.",
      recommendations: [],
    });
  }
  const usedTypes = new Set(snapshot.usedTypes);
  const usedStimuli = new Set(snapshot.usedStimuli.map((item) => item.toLowerCase()));
  const ranked = candidatesFor(snapshot)
    .map((candidate) => ({ candidate, score: scoreOf(candidate, usedTypes, usedStimuli) }))
    .sort((left, right) => right.score - left.score || right.candidate.stimuli.length - left.candidate.stimuli.length || left.candidate.title.localeCompare(right.candidate.title));
  const usable = ranked.filter((item) => item.score >= 2);
  const chosen = (usable.length ? usable : ranked).slice(0, 3);
  if (!chosen.length || chosen.every((item) => item.score < 1)) {
    return experimentPlanSchema.parse({
      ...base,
      sufficient: false,
      insufficientReason: "Every prepared check repeats a stimulus already used. Add a new example before asking for another recommendation.",
      recommendations: [],
    });
  }
  return experimentPlanSchema.parse({
    ...base,
    sufficient: true,
    insufficientReason: "",
    recommendations: chosen.map((item) => recommendationFrom(item.candidate, snapshot, meanings, item.score)),
  });
}

export function reviewRecordedOutcome(recommendation: Recommendation, outcome: string) {
  const match = recommendation.outcomes.find((item) => item.outcome === outcome);
  if (!match) return null;
  return {
    recordedOutcome: outcome,
    supports: match.supports,
    weakens: match.weakens,
    remainingAmbiguity: match.remainingAmbiguity,
    stillPossible: recommendation.competingMeanings,
    distinguishes: match.distinguishes,
    verified: false,
    nextStep: "Compare this with what each person actually did. Then use a different stimulus if a reading is still open. This comparison does not session-verify a meaning.",
  };
}
