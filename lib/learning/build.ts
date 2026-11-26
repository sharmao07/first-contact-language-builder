export type ActivityOption = { id: string; label: string };

export type ActivityDraft = {
  type: string;
  conceptId: string | null;
  prompt: string;
  options: ActivityOption[];
  answerKey: string;
};

type ConceptLite = {
  id: string;
  agreedMeaning: string;
  status: string;
  category: string;
  exampleSituations: string;
  alternativeInterpretations: string;
  contextualNotes: string;
};

type EvidenceLite = {
  id: string;
  conceptId: string | null;
  type: string;
  description: string;
  actionCategory: string | null;
};

type ExpressionLite = {
  id: string;
  title: string;
  conceptIds: string[];
};

const PRACTICEABLE = new Set(["verified"]);

export function buildActivities(input: {
  concepts: ConceptLite[];
  evidence: EvidenceLite[];
  expressions: ExpressionLite[];
  type?: string;
}): ActivityDraft[] {
  const pool = input.concepts.filter((concept) => PRACTICEABLE.has(concept.status) && concept.agreedMeaning);
  const drafts: ActivityDraft[] = [];
  const wanted = input.type;

  for (const concept of pool) {
    const attached = input.evidence.filter((item) => item.conceptId === concept.id);
    if ((!wanted || wanted === "identify_image") && attached.some((item) => item.type === "image" || item.type === "drawing")) {
      drafts.push(choiceActivity("identify_image", concept, pool, `Which current entry matches the image or drawing attached to "${concept.agreedMeaning}"? Practice uses entries already in this session.`));
    }
    if (!wanted || wanted === "match_example") {
      const example = concept.exampleSituations.trim();
      drafts.push(choiceActivity(
        "match_example",
        concept,
        pool,
        example
          ? `Which current entry fits this example? ${example}`
          : `Which session-verified entry is "${concept.agreedMeaning}"? Practice uses meanings this session has already checked.`,
      ));
    }
    if ((!wanted || wanted === "reproduce_gesture") && attached.some((item) => item.type === "gesture")) {
      const gesture = attached.find((item) => item.type === "gesture");
      drafts.push({
        type: "reproduce_gesture",
        conceptId: concept.id,
        prompt: `Reproduce the recorded gesture for "${concept.agreedMeaning}". Description: ${gesture?.description || "No description."} ${gesture?.actionCategory ? `Action label: ${gesture.actionCategory}.` : ""} Then say whether your demonstration matched, felt unsure, or came out different. The app does not watch you.`,
        options: [],
        answerKey: "",
      });
    }
    if ((!wanted || wanted === "identify_audio") && attached.some((item) => item.type === "audio")) {
      drafts.push(choiceActivity("identify_audio", concept, pool, `Which current entry is this stored recording attached to? This does not claim the audio was translated. Entry: "${concept.agreedMeaning}".`));
    }
    if ((!wanted || wanted === "similar_meanings") && concept.alternativeInterpretations.trim()) {
      const alternatives = concept.alternativeInterpretations
        .split(/\n|•/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3);
      if (alternatives.length) {
        drafts.push({
          type: "similar_meanings",
          conceptId: concept.id,
          prompt: `Which reading is the current shared entry, not an alternative that is still on the record? Status: ${concept.status}.`,
          options: [
            { id: concept.id, label: concept.agreedMeaning },
            ...alternatives.map((label, index) => ({ id: `alt-${index + 1}`, label })),
          ],
          answerKey: concept.id,
        });
      }
    }
    if (!wanted || wanted === "demonstrate_expression") {
      const expression = input.expressions.find((item) => item.conceptIds.includes(concept.id));
      if (expression) {
        drafts.push({
          type: "demonstrate_expression",
          conceptId: concept.id,
          prompt: `Demonstrate the expression trial "${expression.title}" for a partner. This trials an order. It is not a grammar of a language. Mark whether they understood, you are unsure, or the demonstration came out different.`,
          options: [],
          answerKey: "",
        });
      }
    }
    if ((!wanted || wanted === "visual_communication") && pool.length >= 2) {
      const other = pool.find((item) => item.id !== concept.id);
      if (other) {
        drafts.push({
          type: "visual_communication",
          conceptId: concept.id,
          prompt: `A visual sequence starts with "${other.agreedMeaning}". Which current entry completes a sequence the participants have actually recorded for "${concept.agreedMeaning}"?`,
          options: pool.slice(0, 4).map((item) => ({ id: item.id, label: item.agreedMeaning })),
          answerKey: concept.id,
        });
      }
    }
  }

  const unique = new Map<string, ActivityDraft>();
  for (const draft of drafts) {
    if (wanted && draft.type !== wanted) continue;
    const key = `${draft.type}:${draft.conceptId}:${draft.prompt}`;
    if (!unique.has(key)) unique.set(key, draft);
  }
  return [...unique.values()].slice(0, wanted ? 4 : 7);
}

function choiceActivity(type: string, concept: ConceptLite, pool: ConceptLite[], prompt: string): ActivityDraft {
  const options = [{ id: concept.id, label: concept.agreedMeaning }];
  for (const item of pool) {
    if (item.id === concept.id) continue;
    options.push({ id: item.id, label: item.agreedMeaning });
    if (options.length >= 4) break;
  }
  return { type, conceptId: concept.id, prompt, options, answerKey: concept.id };
}

export function clarificationFor(concept: {
  agreedMeaning: string;
  status: string;
  alternativeInterpretations: string;
  contextualNotes: string;
}) {
  return [
    `The current shared entry is "${concept.agreedMeaning}" and its status is ${concept.status}.`,
    concept.alternativeInterpretations
      ? `Alternatives still on record: ${concept.alternativeInterpretations}`
      : "No alternative readings are written on the entry.",
    concept.contextualNotes ? `Notes: ${concept.contextualNotes}` : "",
    "A miss is a reason to reopen the concept in the discovery workspace. It is not stored as a failure of either person.",
  ]
    .filter(Boolean)
    .join(" ");
}
