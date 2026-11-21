export const CATEGORIES = [
  "objects",
  "people",
  "relationships",
  "food",
  "water",
  "actions",
  "movement",
  "locations",
  "directions",
  "time",
  "quantities",
  "emotions",
  "questions",
  "requests",
  "warnings",
  "nature",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  objects: "Objects",
  people: "People",
  relationships: "Relationships",
  food: "Food",
  water: "Water",
  actions: "Actions",
  movement: "Movement",
  locations: "Locations",
  directions: "Directions",
  time: "Time",
  quantities: "Quantities",
  emotions: "Emotions",
  questions: "Questions",
  requests: "Requests",
  warnings: "Warnings",
  nature: "Nature",
  other: "Other",
};

export const RELATION_TYPES = [
  "is-a",
  "part-of",
  "associated-with",
  "used-for",
  "causes",
  "performs",
  "located-at",
  "contrasts-with",
  "associated action",
  "held in",
  "part of",
  "location of",
  "agent",
  "contrast",
  "example of",
  "requested by",
  "other",
] as const;

export const EVIDENCE_TYPES = ["image", "drawing", "audio", "video", "gesture", "note"] as const;

export const ACTION_CATEGORIES = [
  "pointing",
  "drinking",
  "movement",
  "greeting",
  "direction",
  "request",
  "warning",
  "showing",
  "other",
] as const;

export const EXPERIMENT_TYPES = [
  "visual_discrimination",
  "context_testing",
  "reverse_demonstration",
  "contrast_testing",
  "repeated_verification",
  "action_demonstration",
  "gesture_reproduction",
  "audio_matching",
  "counterexample",
] as const;

export const VARIED_EXPERIMENT_TYPES = [
  "reverse_demonstration",
  "repeated_verification",
  "action_demonstration",
  "gesture_reproduction",
  "audio_matching",
  "counterexample",
] as const;

export const ACTIVITY_TYPES = [
  "identify_image",
  "match_example",
  "reproduce_gesture",
  "identify_audio",
  "similar_meanings",
  "demonstrate_expression",
  "visual_communication",
] as const;

export const RESULT_VALUES = ["correct", "incorrect", "ambiguous", "disagree"] as const;

export const STATUS_LABEL: Record<string, string> = {
  hypothesis: "Proposed",
  awaiting: "Under verification",
  tentative: "Tentatively accepted",
  verified: "Session-verified",
  disputed: "Disputed",
  reopened: "Reopened",
  archived: "Archived",
  open: "Awaiting participant response",
  accepted: "Accepted by a participant",
  rejected: "Rejected",
  challenged: "Challenged",
  active: "Active",
  paused: "Paused",
  testing: "Being tested",
  understood: "Understood in this trial",
  corrected: "Corrected",
  confirmed: "Participant-confirmed",
  draft: "Draft",
};

export const EXPERIMENT_LABEL: Record<string, string> = {
  visual_discrimination: "Visual discrimination",
  context_testing: "Context testing",
  reverse_demonstration: "Reverse demonstration",
  contrast_testing: "Contrast testing",
  repeated_verification: "Repeated trial with a new stimulus",
  action_demonstration: "Action demonstration",
  gesture_reproduction: "Gesture reproduction",
  audio_matching: "Audio matching",
  counterexample: "Participant counterexample",
};

export const ACTIVITY_LABEL: Record<string, string> = {
  identify_image: "Identify the image",
  match_example: "Match a concept with an example",
  reproduce_gesture: "Reproduce a gesture",
  identify_audio: "Identify an audio recording",
  similar_meanings: "Choose between similar meanings",
  demonstrate_expression: "Demonstrate an expression",
  visual_communication: "Visual communication",
};

export const DEMO_SESSION_CODE = "SHORE-1001";

export function limitBytes(kind: "image" | "audio" | "video") {
  const fallback = { image: 8_000_000, audio: 10_000_000, video: 25_000_000 };
  const raw = Number(process.env[`MAX_${kind.toUpperCase()}_BYTES` as "MAX_IMAGE_BYTES"]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback[kind];
}
