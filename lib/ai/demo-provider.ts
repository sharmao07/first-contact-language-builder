import type { AnalysisResult, AnalyzeInput, HypothesisDraft } from "@/lib/ai/types";

const DEMO_NOTE =
  "Demo mode. These hypotheses were not produced by inspecting the file. They use only the written description, the evidence type, and the action label.";

export function demoAnalyze(input: AnalyzeInput): AnalysisResult {
  const blob = `${input.description} ${input.notes} ${input.actionCategory ?? ""}`.toLowerCase();
  const pack = packFor(blob, input);
  const known = input.knownConcepts
    .map((concept) => concept.meaning)
    .filter(Boolean)
    .slice(0, 6);
  return {
    simulated: true,
    providerNote: DEMO_NOTE,
    observations: [
      DEMO_NOTE,
      `Evidence type on record: ${input.evidenceType}.`,
      input.actionCategory ? `Action label chosen by a participant: ${input.actionCategory}.` : "No action label was selected.",
      input.description ? `Written description: ${clip(input.description)}` : "No written description was attached.",
      input.fileName ? `A file named ${input.fileName} is stored with this evidence. Its bytes were not analyzed.` : "No file bytes are attached.",
    ].slice(0, 8),
    inferences: ["Any meaning below is inferred from the written context, not from the file."],
    cannotDetermine: [
      "The file itself was not inspected.",
      "No phonetic transcription was produced.",
      input.parentEvidenceId ? "A selected video frame was not inspected either." : "What the other participant understood is not determined.",
    ],
    ambiguities: pack.ambiguities,
    followUps: pack.followUps,
    hypotheses: pack.hypotheses.map((hypothesis) => ({
      ...hypothesis,
      alternatives: known.length
        ? `${hypothesis.alternatives} Current session entries to keep distinct: ${known.join("; ")}.`
        : hypothesis.alternatives,
    })),
  };
}

function packFor(blob: string, input: AnalyzeInput): {
  hypotheses: HypothesisDraft[];
  ambiguities: string[];
  followUps: string[];
} {
  if (matches(blob, ["water", "drink", "cup", "glass"])) {
    return waterPack(input);
  }
  if (matches(blob, ["tree", "leaf", "branch"])) return treePack();
  if (matches(blob, ["food", "eat", "meal", "bread", "fruit"])) return foodPack();
  if (matches(blob, ["person", "human", "someone", "people"])) return personPack();
  if (matches(blob, ["move", "walk", "movement", "come", "go", "direction"])) return movementPack();
  if (matches(blob, ["place", "location", "here", "there"])) return locationPack();
  return genericPack(input);
}

function waterPack(input: AnalyzeInput): {
  hypotheses: HypothesisDraft[];
  ambiguities: string[];
  followUps: string[];
} {
  const support = supportLine(input);
  return {
    ambiguities: [
      "Pointing at a glass while miming a drink can indicate the substance, the action, the vessel, or a request.",
      "Nothing in the written context distinguishes water from another drinkable liquid.",
      "A similar gesture can be conventional in one community and opaque in another.",
    ],
    followUps: [
      "Show water, an empty glass, rain, and a river as separate examples.",
      "Ask the other participant to demonstrate the same idea without copying the first gesture.",
      "Try the gesture with no object present, then with an object that is not drinkable.",
    ],
    hypotheses: [
      hypo(
        "Water, the substance",
        "The notes mention a drinkable liquid or a glass. That is compatible with a substance reading, and also with several others.",
        support,
        "Drinking as an action. A request for water. Any liquid.",
        0.46,
        "Contrast a glass of water with an empty glass, rain, and a river. Ask which of those, if any, matches.",
      ),
      hypo(
        "The action of drinking",
        "A drinking action label, or a mime described as drinking, can be about the action rather than the thing being drunk.",
        support,
        "Thirst. Swallowing. A request that someone else drink.",
        0.44,
        "Repeat the action with an empty hand and again with food. See whether the partner treats those as the same idea.",
      ),
      hypo(
        "A container",
        "If a cup or glass is present, the partner may be indicating the object that holds liquid rather than the liquid.",
        support,
        "A cup specifically. Any vessel. The material of the cup.",
        0.31,
        "Present a full glass, an empty glass, and a bowl. Ask the partner to pick what was meant.",
      ),
      hypo(
        "A request for something to drink",
        "The same evidence can be a request rather than a name. Agreement on a picture does not show whether it was a label or a plea.",
        support,
        "Want. Please. A question.",
        0.28,
        "Use the same evidence once while offering a drink and once while naming objects with no social request. Compare the partner's response.",
      ),
    ],
  };
}

function treePack() {
  return {
    ambiguities: ["A drawing of a tree can mean the species, wood, shade, a place, or the idea of a plant."],
    followUps: ["Show a leaf, a forest, and a wooden object as separate follow-ups."],
    hypotheses: [
      hypo("Tree", "The written context points at a tree. The drawing was not inspected in demo mode, so this is only a reading of the note.", "Written context mentions a tree.", "Wood. Forest. Shade. A specific kind of tree.", 0.48, "Contrast one tree with a forest, a leaf, and a wooden cup."),
      hypo("A place marked by a tree", "People often point at a landmark when they mean the location, not the object.", "Written context mentions a tree.", "Here. Outside. A meeting place.", 0.27, "Ask the partner to guide someone to the tree, then to name the tree with no travel."),
      hypo("Wood or plant material", "A tree image is sometimes used for the material rather than the living plant.", "Written context mentions a tree.", "Forest. Stick. Leaf.", 0.22, "Show a living tree and a piece of wood."),
    ],
  };
}

function foodPack() {
  return {
    ambiguities: ["Food evidence may name a meal, an ingredient, hunger, or an offer."],
    followUps: ["Separate eating, a specific food, and an offer of food into three checks."],
    hypotheses: [
      hypo("Food", "The note is compatible with a general food reading.", "Written context mentions food or eating.", "A specific dish. Hunger. An offer.", 0.42, "Contrast a meal, a single ingredient, and the action of eating."),
      hypo("The action of eating", "An eating gesture can name the action rather than the food.", "Written context mentions food or eating.", "Hunger. Cooking. Sharing.", 0.36, "Mime eating with no food present, then show food with no mime."),
      hypo("An offer of food", "Showing food toward another person can be a request or an offer.", "Written context mentions food or eating.", "Please. Want. Hospitality.", 0.24, "Offer food, then later point at food while both people are already eating."),
    ],
  };
}

function personPack() {
  return {
    ambiguities: ["A person indication can mean a human, a specific individual, or the speaker."],
    followUps: ["Contrast self, the other participant, and a third person."],
    hypotheses: [
      hypo("A person", "The note supports a human reading without showing whether it is specific.", "Written context mentions a person.", "Me. You. Someone else. A role such as elder.", 0.4, "Point to self, to the partner, and to an empty place."),
      hypo("The speaker", "Touching or indicating oneself often means the speaker rather than people in general.", "Written context mentions a person.", "I. We. A name.", 0.33, "Have each participant indicate the same third person and then themselves."),
      hypo("A social role", "Person evidence is sometimes about kinship or a role, not the category human.", "Written context mentions a person.", "Friend. Child. Stranger.", 0.2, "Indicate two people with different relationships to the speaker."),
    ],
  };
}

function movementPack() {
  return {
    ambiguities: ["A movement demonstration can mean motion, a direction, come here, or go away."],
    followUps: ["Separate path, speed, and invitation into different demonstrations."],
    hypotheses: [
      hypo("Movement from one place to another", "The action label is compatible with general motion.", "Written context mentions movement.", "Come here. Go away. A path. Walking as a named action.", 0.37, "Demonstrate coming toward the partner and then moving away. Ask whether those are the same idea."),
      hypo("Come here", "Many beckoning movements are invitations, not names for movement.", "Written context mentions movement.", "Go. Follow. A path.", 0.34, "Use the gesture once as an invitation and once while narrating travel with no invitation."),
      hypo("A direction", "Pointing while moving can indicate direction rather than the act of moving.", "Written context mentions movement.", "Left. Toward the tree. Away.", 0.29, "Keep the body still and only point, then move with no point."),
    ],
  };
}

function locationPack() {
  return {
    ambiguities: ["Location evidence can mean here, there, a kind of place, or the object used as a landmark."],
    followUps: ["Test here, there, and a named landmark separately."],
    hypotheses: [
      hypo("A place", "The note supports a location reading but not which place.", "Written context mentions a place.", "Here. There. Home. Outside.", 0.36, "Indicate the current spot, a distant spot, and an object with no spatial claim."),
      hypo("Here, near the speaker", "Location gestures often mean proximity to the speaker.", "Written context mentions a place.", "There. This object. A destination.", 0.3, "Switch speakers and see whether the same gesture still points at the same spot."),
      hypo("A destination", "A place indication during travel can mean the goal rather than a category of place.", "Written context mentions a place.", "Path. Go. Home.", 0.24, "Indicate a place you are not traveling toward."),
    ],
  };
}

function genericPack(input: AnalyzeInput): {
  hypotheses: HypothesisDraft[];
  ambiguities: string[];
  followUps: string[];
} {
  const action = input.actionCategory ?? "unspecified";
  return {
    ambiguities: [
      "The written context is thin, so several incompatible readings fit equally well.",
      "Demo mode cannot see the media, so it cannot narrow the reading from pixels or sound.",
    ],
    followUps: [
      "Add a concrete description of what was pointed at, drawn, or done.",
      "Ask the other participant to reproduce it independently.",
      "Offer two near alternatives and record which one they reject.",
    ],
    hypotheses: [
      hypo(
        "An object being indicated",
        `The evidence is a ${input.evidenceType} with action label "${action}". It may be about an object, but that is not established.`,
        supportLine(input),
        "An action. A request. A property of the object.",
        0.26,
        "Present the object alone, then the action without the object.",
      ),
      hypo(
        "An action being demonstrated",
        "If the participant was doing something, the partner may have understood the action rather than a thing.",
        supportLine(input),
        "A request to perform the action. A warning. A story about the past.",
        0.25,
        "Repeat the action on a different object. If the partner still treats it as the same, the action reading gets support.",
      ),
      hypo(
        "A request or social move",
        "Early contact evidence is often pragmatic. The same sound, picture, or gesture can be a plea, a question, or a name.",
        supportLine(input),
        "A label. A warning. A greeting.",
        0.22,
        "Use the evidence once while asking for help and once while sorting objects with no request.",
      ),
    ],
  };
}

function hypo(
  proposedMeaning: string,
  explanation: string,
  supportingEvidence: string,
  alternatives: string,
  confidence: number,
  suggestedExperiment: string,
): HypothesisDraft {
  return {
    proposedMeaning,
    explanation,
    supportingEvidence,
    alternatives,
    confidence,
    suggestedExperiment,
    missingInformation: "The written context does not say which competing reading the other participant understood.",
    culturalAmbiguity: "The same gesture, picture, or sound can be conventional in one community and opaque in another.",
  };
}

function matches(blob: string, words: string[]) {
  return words.some((word) => blob.includes(word));
}

function supportLine(input: AnalyzeInput) {
  const parts = [
    `Type: ${input.evidenceType}.`,
    input.actionCategory ? `Action label: ${input.actionCategory}.` : "",
    input.description ? `Description: ${clip(input.description)}` : "No description.",
  ].filter(Boolean);
  return parts.join(" ");
}

function clip(value: string) {
  return value.length > 180 ? `${value.slice(0, 177)}...` : value;
}

export const demoProvider = {
  id: "demo" as const,
  async analyze(input: AnalyzeInput) {
    return demoAnalyze(input);
  },
};
