# Phase 5 — Active experiment engine

Date checked: 24 November 2026. Local app: http://127.0.0.1:3010. Nothing was committed, pushed, or deployed. `SHORE-1001` still has 8 concepts and is the only session left after the tests.

This machine is in demo mode. No live model was called. Production Postgres and Supabase Storage were not tested.

## Implemented

The Checks page at `/session/[code]/experiments` plans a check from the session’s own hypotheses, evidence descriptions, locked readings, and earlier stimuli.

For each open reading it records support, contradictions, missing evidence, and overlap with another reading. Overlapping readings are flagged and left unmerged. If there are fewer than two readings, the planner asks for more evidence and does not invent a recommendation.

A recommendation includes a title, research question, the readings it compares, stimuli, procedure, a neutral instruction, possible outcomes, what each outcome would support or weaken, remaining ambiguity, why it is useful, limitations, evidence ids, and a checklist score. The score text says it is a checklist, not information gain and not a claim of optimality.

The facilitator can edit the neutral prompt, approve it, or set it aside. Approval does not verify a meaning. The other person then sees the instruction and submits a response. Outcome mappings stay on the server.

After both responses are locked, the facilitator can compare them with one planned outcome. The review says which readings the plan still treats as possible. It does not mark a hypothesis correct and it does not change the verification rules. One check still cannot session-verify a concept.

The page has a timeline of evidence, readings, recommendations, locked responses, and disagreements. The graph draws readings as diamonds and checks as squares, linked to the concepts they belong to. Those nodes come from saved rows. A community participant does not receive the reading nodes, because the hypotheses are left out of that response.

## Selection method

Demo mode uses written words already stored in the session. A glass-and-drinking description suggests three examples: the empty container, the container with liquid, and the drinking motion with empty hands. Other descriptions suggest a changed scene, a participant-led example, a counterexample, or a repeat with a new stimulus.

The checklist gives points for naming at least two readings, using a new stimulus, using a type that has not been tried, and being possible from stored evidence or a live demonstration. Repeating both the type and the stimulus removes points. Ties prefer the check with more distinct examples. This is not a calculated information gain.

## AI provider

`AIProvider` now has `planExperiments` beside `analyze`. Demo mode returns the rule plan and this exact note: “Simulated experiment recommendation — no model analyzed this session.” The planner says it used written descriptions and did not inspect image, audio, or video bytes.

If `AI_PROVIDER=openai` and a key is set, the OpenAI provider sends the written state and validates the JSON with Zod. A timeout, a rate limit, invalid JSON, or a response that does not match the plan throws. That failure is not replaced with the demo plan. This path was unit-tested with a fake response. It was not called against a live model.

## Data

`ExperimentProposal` gained optional fields for the title, question, competing ids, stimuli, procedure, ambiguity, limitations, evidence refs, usefulness, checklist note and score, the full plan, replies, and the recorded comparison. `VerificationExperiment` gained `proposalId`. Existing rows kept their values. The local database was updated with `prisma db push`. It was not reset.

## Privacy

In a community session, only the facilitator receives hypotheses, outcome mappings, rationale, answer keys, and the other person’s notes. The participant receives the neutral prompt after approval. A response body stays hidden until both people have locked. The experiment journey confirmed the participant JSON had no hypotheses and did not contain the plan’s “stays possible” mapping. The two-browser run watched the participant’s network responses for that phrase and did not find it.

Research and general sessions still share the plan with both seats.

## Tests

- 55 unit tests passed, including 9 new experiment-engine tests.
- TypeScript and ESLint passed.
- Production build passed.
- Smoke, the reliability journey, and the community journey passed on port 3010.
- The experiment HTTP journey passed, including a follow-up with a different stimulus and an outcome that left verification unchanged.
- The two-browser community journey passed.
- The two-browser experiment journey passed: one browser approved a check, the other saw only the instruction, both locked responses, the comparison reloaded, and the mapping did not appear for the participant.
- Afterward, SQLite contained only `SHORE-1001`, with 8 concepts.

## Limits

Demo recommendations are simulated from text. They are not a model’s reading of a file. No live OpenAI plan was run. The checklist is not an optimal experiment design. A community participant does not see hypotheses at all, including on the discovery page, so those readings stay with the facilitator. Production infrastructure is unchanged from Phase 4B: no Supabase credentials, no hosted Postgres test, and no deployment.
