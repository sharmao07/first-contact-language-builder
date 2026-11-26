import { prisma } from "@/lib/database/prisma";
import { DEMO_SESSION_CODE } from "@/lib/constants";
import { isHostedDeployment, removeUploadDir, writeUpload } from "@/lib/storage";
import { deriveVerificationStatus, type TestResult } from "@/lib/verification/status";

const SESSION = "demo_session_shore";
const A = "demo_p_a";
const B = "demo_p_b";

const concepts = {
  water: "demo_c_water",
  drink: "demo_c_drink",
  container: "demo_c_container",
  tree: "demo_c_tree",
  move: "demo_c_move",
  food: "demo_c_food",
  person: "demo_c_person",
  place: "demo_c_place",
} as const;

export async function seedIllustrativeSession() {
  if (isHostedDeployment()) {
    throw new Error("Refusing to seed illustrative sample credentials in a hosted or PostgreSQL environment.");
  }
  const existing = await prisma.discoverySession.findMany({
    where: { OR: [{ isDemo: true }, { code: DEMO_SESSION_CODE }, { id: SESSION }] },
  });
  for (const session of existing) {
    await removeUploadDir(session.id);
    await prisma.discoverySession.delete({ where: { id: session.id } });
  }

  await writeUpload(`${SESSION}/demo_ev_cup.svg`, Buffer.from(drawing("cup", "A glass seen from the side"), "utf8"));
  await writeUpload(`${SESSION}/demo_ev_tree.svg`, Buffer.from(drawing("tree", "A trunk with a round crown"), "utf8"));
  await writeUpload(`${SESSION}/demo_ev_person.svg`, Buffer.from(drawing("person", "A standing figure"), "utf8"));
  await writeUpload(`${SESSION}/demo_ev_tone.wav`, toneWav());

  const water = statusFor(true, false, ["correct", "correct", "correct"]);
  const drink = statusFor(true, false, ["correct", "correct"]);
  const container = statusFor(true, false, ["correct"]);
  const tree = statusFor(true, false, ["correct", "correct"]);
  const move = statusFor(true, false, ["disagree"]);
  const food = statusFor(true, false, []);
  const person = statusFor(true, false, ["correct", "correct"]);
  const place = statusFor(true, false, ["ambiguous"]);

  await prisma.discoverySession.create({
    data: {
      id: SESSION,
      code: DEMO_SESSION_CODE,
      name: "First Contact Experiment 001",
      description:
        "Illustrative sample. Not a record of real linguistic research. The people, dates, and meanings are invented so the workspace, vocabulary, checks, and research views have a complete history.",
      isDemo: true,
      isIllustrative: true,
      revision: 16,
      createdAt: at("2026-04-02T09:00:00.000Z"),
      participants: {
        create: [
          {
            id: A,
            displayName: "Researcher A",
            role: "A",
            token: "demo-shore-1001-participant-a",
            createdAt: at("2026-04-02T09:00:00.000Z"),
            lastSeenAt: at("2026-04-12T15:00:00.000Z"),
          },
          {
            id: B,
            displayName: "Participant B",
            role: "B",
            token: "demo-shore-1001-participant-b",
            createdAt: at("2026-04-02T09:10:00.000Z"),
            lastSeenAt: at("2026-04-12T15:05:00.000Z"),
          },
        ],
      },
    },
  });

  await prisma.concept.createMany({
    data: [
      concept(concepts.water, "C-001", "Water, the substance", "water", water, 0.46, "A glass was present, so a container reading and a drinking reading were both live for several checks.", "Offered in a glass. Later contrasted with rain and a river.", "The action of drinking.\nA request for a drink.\nA river.", "2026-04-02T09:30:00.000Z"),
      concept(concepts.drink, "C-002", "The action of drinking", "actions", drink, 0.44, "Split from the water evidence after the mime still made sense with an empty hand.", "Mime with a glass, then mime with an empty hand.", "Thirst.\nA request that someone else drink.", "2026-04-05T10:00:00.000Z"),
      concept(concepts.container, "C-003", "A container that can hold a drink", "objects", container, 0.31, "Only one check has been recorded, so the entry stays unresolved.", "An empty glass shown beside a full one.", "The glass specifically.\nAny vessel.", "2026-04-05T11:00:00.000Z"),
      concept(concepts.tree, "C-004", "Tree", "nature", tree, 0.48, "A drawing was not enough on its own. A second check used a different example.", "A drawing, then a separate indication of one tree rather than a forest.", "Wood.\nA place marked by a tree.", "2026-04-06T09:00:00.000Z"),
      concept(concepts.move, "C-005", "Movement from one place to another", "movement", move, 0.37, "Researcher A read the gesture as travel. Participant B read it as come here. The disagreement is unresolved.", "A walking gesture toward the tree.", "Come here.\nA direction.", "2026-04-10T09:00:00.000Z"),
      concept(concepts.food, "C-006", "Food", "food", food, 0.42, "The participants agree provisionally. No check has been run, so this is not verified.", "A meal placed between the two people.", "The action of eating.\nAn offer of food.", "2026-04-08T12:00:00.000Z"),
      concept(concepts.person, "C-007", "A person", "people", person, 0.4, "Self and other were checked separately before this stayed on the general reading.", "Each participant indicated the other, then a drawing of a third figure.", "The speaker.\nA specific role.", "2026-04-07T09:30:00.000Z"),
      concept(concepts.place, "C-008", "A place", "locations", place, 0.36, "The only check was marked ambiguous, so the place reading is not established.", "Pointing at the ground near the tree.", "Here, near the speaker.\nA destination.", "2026-04-09T14:00:00.000Z"),
    ],
  });

  await prisma.vocabularyEntry.createMany({
    data: Object.values(concepts).map((conceptId) => ({
      sessionId: SESSION,
      conceptId,
      summary: "Illustrative vocabulary entry",
      createdAt: at("2026-04-11T09:00:00.000Z"),
    })),
  });

  await prisma.evidence.createMany({
    data: [
      evidence("demo_ev_water_gesture", A, concepts.water, "gesture", null, null, null, "Points at a glass and mimes drinking.", "drinking", "Researcher A did not say a word. The glass and the mime happened together, so the referent is ambiguous.", "2026-04-02T09:20:00.000Z"),
      evidence("demo_ev_cup", B, concepts.water, "drawing", `${SESSION}/demo_ev_cup.svg`, "image/svg+xml", "glass.svg", "Drawing of a glass.", null, "Participant B drew the vessel after the mime. This drawing is an illustration, not a photograph.", "2026-04-03T10:00:00.000Z"),
      evidence("demo_ev_tone", B, concepts.water, "audio", `${SESSION}/demo_ev_tone.wav`, "audio/wav", "tone.wav", "A short illustrative tone while indicating the glass.", null, "This is a generated tone, not speech. It has not been transcribed and must not be treated as a translation.", "2026-04-03T10:20:00.000Z"),
      evidence("demo_ev_tree", A, concepts.tree, "drawing", `${SESSION}/demo_ev_tree.svg`, "image/svg+xml", "tree.svg", "Drawing of one tree.", "pointing", "Used later in a contrast with a forest gesture that was not accepted as the same meaning.", "2026-04-06T09:10:00.000Z"),
      evidence("demo_ev_person", B, concepts.person, "image", `${SESSION}/demo_ev_person.svg`, "image/svg+xml", "person.svg", "Drawing of a standing person.", "showing", "Illustrative drawing submitted as image evidence.", "2026-04-07T09:40:00.000Z"),
      evidence("demo_ev_move", A, concepts.move, "gesture", null, null, null, "Walks two steps toward the tree and beckons.", "movement", "Participant B later treated the beckon as come here rather than as the name of movement.", "2026-04-10T09:10:00.000Z"),
      evidence("demo_ev_food", B, concepts.food, "note", null, null, null, "Sets a piece of bread between the two people and waits.", "showing", "No photograph was kept. The note is the evidence.", "2026-04-08T12:10:00.000Z"),
      evidence("demo_ev_place", A, concepts.place, "gesture", null, null, null, "Points at the ground beside the tree.", "direction", "Could be the place, the tree, or here.", "2026-04-09T14:10:00.000Z"),
    ],
  });

  await prisma.conceptHypothesis.createMany({
    data: [
      hypothesis("demo_h_water", concepts.water, "demo_ev_water_gesture", "Water, the substance", "Accepted after the river reading and the container reading were separated.", "Gesture plus later contrast checks.", "Drinking. Container. Request.", 0.46, "Contrast water, rain, river, and an empty glass.", "ai", "accepted", true, A, "2026-04-04T09:00:00.000Z"),
      hypothesis("demo_h_river", concepts.water, "demo_ev_water_gesture", "A river", "Rejected. Nothing in the first evidence showed a landscape.", "Only the drinking mime.", "Water in a glass. Rain.", 0.18, "Show a river picture beside a glass.", "ai", "rejected", true, null, "2026-04-02T09:40:00.000Z"),
      hypothesis("demo_h_request", concepts.water, "demo_ev_water_gesture", "A request for something to drink", "Left open. The participants have not decided whether the first mime was also a plea.", "The mime was directed at the other person.", "A label for water. The action of drinking.", 0.28, "Repeat the mime while refusing a drink and again while offering one.", "ai", "open", true, null, "2026-04-02T09:41:00.000Z"),
      hypothesis("demo_h_drink", concepts.drink, "demo_ev_water_gesture", "The action of drinking", "Accepted as its own entry after an empty-hand mime.", "The action survived without the glass.", "Thirst. Swallowing.", 0.44, "Mime drinking with no object.", "ai", "accepted", true, B, "2026-04-05T10:20:00.000Z"),
      hypothesis("demo_h_container", concepts.container, "demo_ev_cup", "A container that can hold a drink", "Accepted tentatively from the drawing, with one later check.", "The drawing emphasized the vessel.", "The glass specifically.", 0.31, "Compare a full glass, an empty glass, and a bowl.", "ai", "accepted", true, A, "2026-04-05T11:10:00.000Z"),
      hypothesis("demo_h_tree", concepts.tree, "demo_ev_tree", "Tree", "Accepted, then checked twice with different examples.", "Drawing of one tree.", "Wood. Forest. A meeting place.", 0.48, "Contrast one tree, a forest, and a wooden object.", "ai", "accepted", true, A, "2026-04-06T11:00:00.000Z"),
      hypothesis("demo_h_move", concepts.move, "demo_ev_move", "Movement from one place to another", "Challenged. Participant B read the same gesture as an invitation.", "Walking plus a beckon.", "Come here. A direction.", 0.37, "Separate the walk from the beckon.", "ai", "challenged", true, B, "2026-04-10T10:00:00.000Z"),
      hypothesis("demo_h_come", concepts.move, "demo_ev_move", "Come here", "Participant interpretation, still disputed against the movement reading.", "The beckoning part of the gesture.", "Go away. Follow me.", 0.34, "Use the beckon with no walking.", "participant", "open", false, B, "2026-04-10T10:05:00.000Z"),
      hypothesis("demo_h_food", concepts.food, "demo_ev_food", "Food", "Provisional agreement. Not checked.", "Bread placed between the participants.", "Eating. An offer.", 0.42, "Show an ingredient, a meal, and the action of eating separately.", "participant", "accepted", false, B, "2026-04-08T12:30:00.000Z"),
      hypothesis("demo_h_person", concepts.person, "demo_ev_person", "A person", "Accepted after self and other were distinguished.", "Drawing plus pointing.", "The speaker. A role.", 0.4, "Indicate self, partner, and an absent person.", "ai", "accepted", true, A, "2026-04-07T11:00:00.000Z"),
      hypothesis("demo_h_place", concepts.place, "demo_ev_place", "A place", "Accepted, then the only check was ambiguous.", "Pointing at the ground.", "Here. The tree. A destination.", 0.36, "Point here, point there, and point at the tree with no ground.", "ai", "accepted", true, A, "2026-04-09T15:00:00.000Z"),
    ],
  });

  await prisma.conceptRelationship.createMany({
    data: [
      link("demo_r1", concepts.water, concepts.drink, "associated action", "confirmed", "Participants treated the action as related to, but not the same as, the substance."),
      link("demo_r2", concepts.water, concepts.container, "held in", "hypothesis", "The glass drawing suggests a container relation. Not confirmed."),
      link("demo_r3", concepts.drink, concepts.container, "contrast", "hypothesis", "Used to keep the action distinct from the vessel."),
      link("demo_r4", concepts.tree, concepts.place, "location of", "hypothesis", "The tree may be a landmark for the place entry. The place entry is not verified."),
      link("demo_r5", concepts.person, concepts.drink, "agent", "confirmed", "A person was the one doing the drinking mime."),
      link("demo_r6", concepts.food, concepts.person, "requested by", "hypothesis", "The bread may have been an offer. That reading is not checked."),
      link("demo_r7", concepts.move, concepts.place, "contrast", "hypothesis", "Movement and place were easy to collapse. The dispute on movement is unresolved."),
    ],
  });

  await experimentPair("demo_x_water_1", concepts.water, "visual_discrimination", 1, "Which current entry matches a new glass of water, not the original mime?", B, "correct", concepts.water, "2026-04-04T15:00:00.000Z");
  await experimentPair("demo_x_water_2", concepts.water, "contrast_testing", 2, "The partner shows rain, a river, and a glass. Which entry is the intended one?", B, "correct", concepts.water, "2026-04-04T16:00:00.000Z");
  await experimentPair("demo_x_water_3", concepts.water, "repeated_verification", 3, "A different glass, in a different place. Which entry matches?", A, "correct", concepts.water, "2026-04-05T09:00:00.000Z");
  await experimentPair("demo_x_drink_1", concepts.drink, "reverse_demonstration", 1, "Participant B mimes drinking with an empty hand. Researcher A judges the intended meaning.", A, "correct", "", "2026-04-05T10:40:00.000Z");
  await experimentPair("demo_x_drink_2", concepts.drink, "context_testing", 2, "The mime happens during a meal. Which entry fits the action rather than the food?", B, "correct", concepts.drink, "2026-04-05T11:40:00.000Z");
  await experimentPair("demo_x_container_1", concepts.container, "visual_discrimination", 1, "An empty glass is shown. Which entry, if any, matches?", B, "correct", concepts.container, "2026-04-05T12:10:00.000Z");
  await experimentPair("demo_x_tree_1", concepts.tree, "visual_discrimination", 1, "Which entry matches the drawing of one tree?", B, "correct", concepts.tree, "2026-04-06T12:00:00.000Z");
  await experimentPair("demo_x_tree_2", concepts.tree, "contrast_testing", 2, "A forest gesture is offered as a near alternative. Which entry was intended?", A, "correct", concepts.tree, "2026-04-06T15:00:00.000Z");
  await experimentPair("demo_x_person_1", concepts.person, "context_testing", 1, "Each person points at the other. Which entry fits both demonstrations?", B, "correct", concepts.person, "2026-04-07T12:00:00.000Z");
  await experimentPair("demo_x_person_2", concepts.person, "reverse_demonstration", 2, "Participant B indicates an absent third person. Researcher A judges it.", A, "correct", "", "2026-04-07T15:00:00.000Z");
  await experimentPair("demo_x_place_1", concepts.place, "context_testing", 1, "The same point could mean the tree. The response is marked ambiguous.", B, "ambiguous", "", "2026-04-09T16:00:00.000Z");
  await experimentPair("demo_x_move_1", concepts.move, "contrast_testing", 1, "Is the gesture travel, or come here?", B, "disagree", concepts.move, "2026-04-10T11:00:00.000Z");

  await prisma.learningActivity.create({
    data: {
      id: "demo_act_tree",
      sessionId: SESSION,
      conceptId: concepts.tree,
      type: "identify_image",
      prompt: "Which current entry matches the drawing attached to Tree? Practice uses entries already in this session.",
      optionsJson: JSON.stringify([
        { id: concepts.tree, label: "Tree" },
        { id: concepts.water, label: "Water, the substance" },
        { id: concepts.person, label: "A person" },
      ]),
      answerKey: concepts.tree,
      createdAt: at("2026-04-11T10:00:00.000Z"),
      responses: {
        create: {
          participantId: B,
          correct: true,
          clarification: "Recorded against the current shared entry. You can still revise that entry in discovery.",
          responseJson: JSON.stringify({ selectedOptionId: concepts.tree, notes: "" }),
          createdAt: at("2026-04-11T10:05:00.000Z"),
        },
      },
    },
  });

  await prisma.learningActivity.create({
    data: {
      id: "demo_act_water",
      sessionId: SESSION,
      conceptId: concepts.water,
      type: "similar_meanings",
      prompt: "Which reading is the current shared entry for the water concept, not an alternative still on the record?",
      optionsJson: JSON.stringify([
        { id: concepts.water, label: "Water, the substance" },
        { id: "alt-1", label: "The action of drinking" },
        { id: "alt-2", label: "A request for a drink" },
      ]),
      answerKey: concepts.water,
      createdAt: at("2026-04-11T10:20:00.000Z"),
      responses: {
        create: {
          participantId: A,
          correct: false,
          clarification: "The current shared entry is water as a substance. Drinking and a request remain alternatives. A miss is a reason to look again, not a failed person.",
          responseJson: JSON.stringify({ selectedOptionId: "alt-1", notes: "I chose the action." }),
          createdAt: at("2026-04-11T10:25:00.000Z"),
        },
      },
    },
  });

  await prisma.expression.create({
    data: {
      id: "demo_expr_1",
      sessionId: SESSION,
      title: "Person, drinking, water",
      gloss: "A possible way to convey that a person drinks water. The gloss is a participant hypothesis, not a translation.",
      orderNote: "The order used in this trial is person, then drinking, then water. Another order can be tried.",
      grammarNote: "Grammar hypothesis only. Nothing here establishes word order, agreement, or a rule of a language.",
      status: "testing",
      createdAt: at("2026-04-11T14:00:00.000Z"),
      concepts: {
        create: [
          { conceptId: concepts.person, position: 0 },
          { conceptId: concepts.drink, position: 1 },
          { conceptId: concepts.water, position: 2 },
        ],
      },
    },
  });

  await prisma.researchNote.createMany({
    data: [
      {
        id: "demo_note_method",
        sessionId: SESSION,
        authorParticipantId: A,
        title: "How to read this sample",
        body: "This session is illustrative. It shows meanings being split, rejected, and left open. It is not evidence about any community's language.",
        createdAt: at("2026-04-02T09:15:00.000Z"),
      },
      {
        id: "demo_note_water",
        sessionId: SESSION,
        conceptId: concepts.water,
        authorParticipantId: A,
        title: "Substance, action, and vessel",
        body: "The first mime supported at least four readings. The river reading was rejected. Drinking and the container were given their own entries instead of being folded into water. A request reading is still open.",
        createdAt: at("2026-04-05T16:00:00.000Z"),
      },
      {
        id: "demo_note_move",
        sessionId: SESSION,
        conceptId: concepts.move,
        authorParticipantId: B,
        title: "Disagreement on the beckon",
        body: "I treated the gesture as come here. Researcher A treated it as movement. We did not average the two readings. The entry stays disputed.",
        createdAt: at("2026-04-10T11:30:00.000Z"),
      },
    ],
  });

  await prisma.sessionEvent.createMany({
    data: [
      event("session.created", "Researcher A opened the illustrative session.", A, "2026-04-02T09:00:00.000Z"),
      event("participant.joined", "Participant B joined.", B, "2026-04-02T09:10:00.000Z"),
      event("evidence.added", "Researcher A added a drinking gesture aimed at a glass.", A, "2026-04-02T09:20:00.000Z"),
      event("analysis.completed", "Demo hypotheses listed water, drinking, a container, a request, and a river. None were verified.", A, "2026-04-02T09:41:00.000Z"),
      event("hypothesis.rejected", "The river reading was rejected.", B, "2026-04-04T09:30:00.000Z"),
      event("hypothesis.accepted", "Water, the substance, was accepted as a tentative interpretation.", A, "2026-04-04T10:00:00.000Z"),
      event("experiment.answered", "Two later checks matched the substance reading. The entry met the verification rule and can still be reopened.", B, "2026-04-05T09:10:00.000Z"),
      event("concept.created", "Drinking was split into its own entry.", B, "2026-04-05T10:20:00.000Z"),
      event("concept.created", "The container stayed on a single check and was not verified.", A, "2026-04-05T12:10:00.000Z"),
      event("experiment.answered", "Tree passed two different checks.", A, "2026-04-06T15:10:00.000Z"),
      event("experiment.answered", "The place check was marked ambiguous.", B, "2026-04-09T16:10:00.000Z"),
      event("concept.disputed", "Movement was disputed after the come-here reading.", B, "2026-04-10T11:05:00.000Z"),
      event("expression.created", "An expression trial ordered person, drinking, and water. The order is a hypothesis.", A, "2026-04-11T14:00:00.000Z"),
      event("activity.answered", "A practice answer chose drinking instead of the water entry. The clarification pointed back at the record.", A, "2026-04-11T10:25:00.000Z"),
      event("note.added", "A note recorded that the beckon and the walk were not averaged together.", B, "2026-04-10T11:30:00.000Z"),
    ],
  });

  const summaries: Record<string, string> = {
    [concepts.water]: "Water, the substance (verified)",
    [concepts.drink]: "The action of drinking (verified)",
    [concepts.container]: "A container that can hold a drink (awaiting)",
    [concepts.tree]: "Tree (verified)",
    [concepts.move]: "Movement from one place to another (disputed)",
    [concepts.food]: "Food (tentative)",
    [concepts.person]: "A person (verified)",
    [concepts.place]: "A place (awaiting)",
  };
  for (const [conceptId, summary] of Object.entries(summaries)) {
    await prisma.vocabularyEntry.update({ where: { conceptId }, data: { summary } });
  }
}

function statusFor(accepted: boolean, disputed: boolean, results: TestResult[]) {
  const types = ["visual_discrimination", "contrast_testing", "context_testing"];
  return deriveVerificationStatus({
    archived: false,
    disputed,
    participantAccepted: accepted,
    checks: results.map((result, index) => ({
      result,
      stimulusKey: `${types[index % types.length]}:${index}`,
      experimentType: types[index % types.length],
      authorId: index % 2 === 0 ? "participant-a" : "participant-b",
    })),
  });
}

function concept(
  id: string,
  conceptCode: string,
  agreedMeaning: string,
  category: string,
  derived: { status: string; reason: string },
  aiConfidence: number,
  contextualNotes: string,
  exampleSituations: string,
  alternativeInterpretations: string,
  createdAt: string,
) {
  return {
    id,
    sessionId: SESSION,
    conceptCode,
    agreedMeaning,
    category,
    status: derived.status,
    statusReason: derived.reason,
    contextualNotes,
    exampleSituations,
    alternativeInterpretations,
    aiConfidence,
    createdAt: at(createdAt),
    updatedAt: at(createdAt),
  };
}

function evidence(
  id: string,
  participantId: string,
  conceptId: string,
  type: string,
  storagePath: string | null,
  mimeType: string | null,
  fileName: string | null,
  description: string,
  actionCategory: string | null,
  notes: string,
  createdAt: string,
) {
  return {
    id,
    sessionId: SESSION,
    participantId,
    conceptId,
    type,
    storagePath,
    mimeType,
    fileName,
    byteSize: storagePath ? 1 : null,
    description,
    actionCategory,
    notes,
    createdAt: at(createdAt),
  };
}

function hypothesis(
  id: string,
  conceptId: string,
  evidenceId: string,
  proposedMeaning: string,
  explanation: string,
  supportingEvidence: string,
  alternatives: string,
  confidence: number,
  suggestedExperiment: string,
  source: string,
  status: string,
  simulated: boolean,
  createdByParticipantId: string | null,
  createdAt: string,
) {
  return {
    id,
    sessionId: SESSION,
    conceptId,
    evidenceId,
    proposedMeaning,
    explanation,
    supportingEvidence,
    alternatives,
    confidence,
    suggestedExperiment,
    source,
    status,
    simulated,
    providerNote: simulated
      ? "Illustrative demo hypothesis. No model inspected a file."
      : "Participant interpretation in the sample session.",
    createdByParticipantId,
    createdAt: at(createdAt),
  };
}

function link(id: string, fromConceptId: string, toConceptId: string, relationType: string, status: string, notes: string) {
  return { id, sessionId: SESSION, fromConceptId, toConceptId, relationType, status, notes, createdAt: at("2026-04-11T09:00:00.000Z") };
}

async function experimentPair(
  id: string,
  conceptId: string,
  type: string,
  round: number,
  prompt: string,
  participantId: string,
  result: string,
  selectedOptionId: string,
  createdAt: string,
) {
  await prisma.verificationExperiment.create({
    data: {
      id,
      sessionId: SESSION,
      conceptId,
      type,
      prompt,
      optionsJson: "[]",
      round,
      status: "closed",
      createdAt: at(createdAt),
      responses: {
        create: {
          sessionId: SESSION,
          participantId,
          result,
          notes: "Illustrative response.",
          responseJson: JSON.stringify({ selectedOptionId }),
          createdAt: at(createdAt),
        },
      },
    },
  });
}

function event(type: string, message: string, participantId: string, createdAt: string) {
  return { sessionId: SESSION, type, message, participantId, payloadJson: "{}", createdAt: at(createdAt) };
}

function at(value: string) {
  return new Date(value);
}

function drawing(kind: string, label: string) {
  const body =
    kind === "tree"
      ? `<rect x="68" y="70" width="8" height="40" fill="#1c2430"/><circle cx="72" cy="58" r="26" fill="none" stroke="#0f6b66" stroke-width="2"/>`
      : kind === "person"
        ? `<circle cx="72" cy="36" r="12" fill="none" stroke="#1c2430" stroke-width="2"/><path d="M72 48 V86 M72 60 H52 M72 60 H92 M72 86 L58 112 M72 86 L86 112" fill="none" stroke="#1c2430" stroke-width="2"/>`
        : `<path d="M40 48 H104 L96 100 H48 Z" fill="none" stroke="#1d4f86" stroke-width="2"/><path d="M48 70 H96" stroke="#0f6b66" stroke-width="2"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="140" viewBox="0 0 160 140">
  <desc>Illustrative drawing: ${label}. Not a photograph and not a real fieldwork record.</desc>
  <rect width="160" height="140" fill="#faf7f1"/>
  ${body}
</svg>`;
}

function toneWav() {
  const sampleRate = 8000;
  const count = sampleRate;
  const data = Buffer.alloc(count * 2);
  for (let index = 0; index < count; index += 1) {
    const value = Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.15;
    data.writeInt16LE(Math.round(value * 32767), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
