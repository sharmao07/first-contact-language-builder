export const SCENARIO_STEPS = ["show", "respond", "compare", "ambiguity", "test", "outcome"] as const;

export type ScenarioStep = (typeof SCENARIO_STEPS)[number];

export type ScenarioTemplate = {
  id: string;
  category: string;
  title: string;
  show: string;
  respond: string;
};

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  { id: "find-place", category: "Locations and directions", title: "Finding a place", show: "Point, draw a path, or show a picture of the place.", respond: "Show where you think that leads, without reading a suggested meaning." },
  { id: "everyday-item", category: "Everyday needs", title: "Asking for an everyday item", show: "Show the object, or mime using it.", respond: "Draw or point to what you think is being asked for." },
  { id: "preference", category: "Food and water", title: "Communicating a preference", show: "Show one option you want and one you do not.", respond: "Indicate which option you think was chosen." },
  { id: "identify-location", category: "Locations and directions", title: "Identifying a location", show: "Show the location from where you are standing.", respond: "Mark the place you think was indicated." },
  { id: "demonstrate-action", category: "Requests for assistance", title: "Demonstrating an action", show: "Perform the action once, with no spoken sentence required.", respond: "Repeat what you think the action was, in your own way." },
  { id: "confirm-request", category: "Consent and personal boundaries", title: "Confirming whether a request was understood", show: "Make the request with a gesture. Stop if the other person signals no.", respond: "Show what you think was requested, or signal that you are unsure." },
  { id: "greeting", category: "Greetings", title: "A greeting", show: "Offer the greeting you use. A wave, a nod, or a sound is enough.", respond: "Answer with what you think that greeting is asking for, if anything." },
  { id: "quantity", category: "Time and quantities", title: "How many, or when", show: "Show a number or a time with your hands or marks.", respond: "Show the number or time you understood." },
  { id: "people", category: "People and relationships", title: "A person or a relationship", show: "Point to a person or draw the relationship. Do not require a name.", respond: "Show who you think was indicated." },
];

export function scenarioById(id: string) {
  return SCENARIO_TEMPLATES.find((item) => item.id === id) ?? null;
}

export const STEP_LABEL: Record<ScenarioStep, string> = {
  show: "Show",
  respond: "Respond",
  compare: "Compare",
  ambiguity: "Name what is unclear",
  test: "Run a check",
  outcome: "Record the outcome",
};
