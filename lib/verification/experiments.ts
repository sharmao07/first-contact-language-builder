import { EXPERIMENT_LABEL, EXPERIMENT_TYPES, VARIED_EXPERIMENT_TYPES } from "@/lib/constants";

export type ExperimentOption = { id: string; label: string };

export type ExperimentDraft = {
  prompt: string;
  options: ExperimentOption[];
  stimulusKey: string;
  stimulusVariation: string;
};

type ConceptLite = {
  id: string;
  agreedMeaning: string;
  alternativeInterpretations: string;
};

const TYPE_SET = new Set<string>(EXPERIMENT_TYPES);

const VARIED = new Set<string>(VARIED_EXPERIMENT_TYPES);

export function stimulusIdentity(type: string, options: ExperimentOption[], note: string) {
  const cleaned = note.trim().toLowerCase().replace(/\s+/g, " ");
  if (VARIED.has(type)) return `${type}:${cleaned || "unspecified"}`;
  const ids = options.map((option) => option.id).sort().join(",");
  return `${type}:${ids}`;
}

export function buildExperiment(input: {
  type: string;
  concept: ConceptLite;
  siblings: ConceptLite[];
  round: number;
  stimulusNote?: string;
}): ExperimentDraft {
  if (!TYPE_SET.has(input.type)) {
    throw new Error("Unknown experiment type.");
  }
  const meaning = input.concept.agreedMeaning || "the current interpretation";
  const options = optionsFromSession(input.concept, input.siblings);
  const label = EXPERIMENT_LABEL[input.type] ?? input.type;
  const round = `Check ${input.round}.`;
  const note = input.stimulusNote?.trim() ?? "";
  const variation = note || "The stimulus is the set of entries currently in the session.";
  const stimulusKey = stimulusIdentity(input.type, options, note);
  const finish = (prompt: string, choices: ExperimentOption[]): ExperimentDraft => ({
    prompt,
    options: choices,
    stimulusKey,
    stimulusVariation: variation,
  });

  if (input.type === "object_substitution") {
    return finish(
      `${round} ${label}. Keep the same situation and replace the object${note ? `: ${note}` : ""}. The other person says whether this still matches the earlier expression, does not, or is unclear. The choice is their judgment, not a score.`,
      options,
    );
  }

  if (input.type === "participant_led") {
    return finish(
      `${round} ${label}. The person who did not choose the first example demonstrates what they think was meant, using their own example${note ? `: ${note}` : ""}. The other person records whether that demonstration matches, misses, or is mixed. Neither person is told which reading was expected.`,
      [],
    );
  }

  if (input.type === "reverse_demonstration" || input.type === "action_demonstration" || input.type === "gesture_reproduction") {
    return finish(
      `${round} ${label}. One participant demonstrates "${meaning}" without a shared spoken language${note ? `. What is different this time: ${note}` : ""}. The other participant records whether that demonstration communicated the intended meaning, something else, or a mix. This is a participant judgment, not an automatic score.`,
      [],
    );
  }

  if (input.type === "audio_matching") {
    return finish(
      `${round} ${label}. Play a recording already stored in this session${note ? ` (${note})` : ""}. Which current entry, if any, is the sound being used for? Do not treat an unfamiliar recording as transcribed speech.`,
      options,
    );
  }

  if (input.type === "counterexample") {
    return finish(
      `${round} ${label}. A participant offers a case that may break "${meaning}"${note ? `: ${note}` : ""}. Record whether the case still fits, fails, or is ambiguous.`,
      options,
    );
  }

  if (input.type === "context_testing") {
    return finish(
      `${round} ${label}. Use "${meaning}" in a new situation that is not a copy of the original evidence. Which current entry fits the situation the partner just demonstrated? If none fit, mark the response ambiguous or record a disagreement.`,
      options,
    );
  }

  if (input.type === "contrast_testing") {
    return finish(
      `${round} ${label}. The partner presents a near alternative. Which current entry, if any, is the one you intended by "${meaning}"? Similar entries are listed so they can be told apart. Matching the label once does not settle the meaning.`,
      options,
    );
  }

  if (input.type === "repeated_verification") {
    return finish(
      `${round} ${label}. Use a different example from the last check${note ? `: ${note}` : ""}. Which current entry matches the new example of "${meaning}"? The same picture or the same experiment does not count as a new stimulus.`,
      options,
    );
  }

  return finish(
    `${round} ${label}. A new visual example is presented. Which current entry matches the intended concept "${meaning}"? Choose only among meanings already recorded in this session.`,
    options,
  );
}

function optionsFromSession(concept: ConceptLite, siblings: ConceptLite[]): ExperimentOption[] {
  const options: ExperimentOption[] = [
    { id: concept.id, label: concept.agreedMeaning || "Current interpretation" },
  ];
  for (const sibling of siblings) {
    if (sibling.id === concept.id) continue;
    if (!sibling.agreedMeaning) continue;
    if (options.some((option) => option.id === sibling.id)) continue;
    options.push({ id: sibling.id, label: sibling.agreedMeaning });
    if (options.length >= 4) break;
  }
  const alternatives = concept.alternativeInterpretations
    .split(/\n|•/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);
  alternatives.forEach((label, index) => {
    options.push({ id: `alternative-${index + 1}`, label: `Alternative reading: ${label}` });
  });
  return options;
}
