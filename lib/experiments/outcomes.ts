const TAG_WORDS: Record<string, string[]> = {
  object: ["container", "object", "cup", "glass", "holder", "vessel", "bag"],
  substance: ["water", "liquid", "substance"],
  action: ["action", "drinking", "motion", "giving", "gesture", "walk"],
  place: ["place", "destination", "location", "path", "tree"],
  direction: ["direction", "left", "right"],
  person: ["person"],
  relationship: ["relationship", "family"],
  quantity: ["quantity", "number"],
  intensity: ["intensity", "stronger"],
  sound: ["sound", "spoken", "voice"],
  noise: ["noise", "rain"],
  possession: ["holding", "possession"],
  ownership: ["belongs", "ownership"],
  request: ["request"],
  name: ["name"],
};

export type StimulusContrast = { stimulus: string; tags: string[] };

export function tagsForMeaning(meaning: string) {
  const words = new Set(meaning.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  return Object.entries(TAG_WORDS)
    .filter(([, list]) => list.some((word) => words.has(word)))
    .map(([tag]) => tag);
}

export function bindContrasts(meanings: string[], contrasts: StimulusContrast[]) {
  const used = new Set<string>();
  const bound: Array<{ meaning: string; stimulus: string }> = [];
  for (const meaning of meanings) {
    const tags = tagsForMeaning(meaning);
    const match = contrasts.find((item) => !used.has(item.stimulus) && item.tags.some((tag) => tags.includes(tag)));
    if (!match) return null;
    used.add(match.stimulus);
    bound.push({ meaning, stimulus: match.stimulus });
  }
  if (new Set(bound.map((item) => item.stimulus)).size < meanings.length) return null;
  return bound;
}

export const DRAFT_LIMIT = "Draft. A facilitator needs to review this before it is treated as a distinguishing check. The planner could not tie each reading to a different example.";
