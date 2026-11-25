# Phase 7 — Independent audit

Date checked: 24 November 2026. Local app: http://127.0.0.1:3010. Nothing was committed, pushed, or deployed. `SHORE-1001` still has 8 concepts and is the only session left. Temporary sessions used for the probes were deleted.

No live model was called. Health reported `mode=demo`. Provider failures were tested with mocked responses or by reading the server code. This audit did not treat the happy-path screens as proof of privacy.

## 1. Executive assessment

The community session API does keep hypotheses, outcome mappings, quality notes, and facilitator notes off Participant B’s session payload, including sync. A direct export and the activity log did not. Those two holes were confirmed with API calls and then closed. A suggested check no longer opens the other person’s locked response early.

The experiment planner is still a rule template. Its strongest object-versus-substance recommendation no longer uses the word “container,” but a weaker alternative that does is still saved and can be approved. Outcome text is generic. It does not show that the first example actually tests the first reading. The eight-point number remains a count of passed checks. The note says it is not a probability and not information gain.

One facilitator, with no second person present, was able to accept a meaning and mark two of their own checks correct. The concept became session-verified. The stored reason correctly says this is agreement inside the session, not linguistic truth. The rule does not require the other person to answer.

The app is not ready for volunteer pairs on a machine or network that other people can reach. A supervised local pair can use a community session if they treat demo recommendations as simulated, do not treat session-verified as mutual agreement, and do not put the server on a shared network.

## 2. Findings

### Critical

None remained after the fixes below. Before the fixes, two issues were critical:

- `GET /api/research/export` and `GET /api/research` required no token. A community participant, or anyone who could open the port, could download hypothesis wording, facilitator notes, and evidence descriptions for every session, including sessions they had not joined.
- Session events quoted hypothesis wording, a check result such as “correct,” and a recorded outcome. Participant B received those sentences in `GET /api/sessions/[code]` even though `hypotheses` was an empty array. The UI was not required.

### High

1. One seat can session-verify a concept alone.
   - Files: `lib/verification/status.ts`, `lib/domain/checks.ts`, `app/api/sessions/[code]/experiments/route.ts`, `app/api/sessions/[code]/experiments/[id]/respond/route.ts`.
   - Reproduction: in a temporary community session, the facilitator accepted “A cup,” recorded `correct` on `contrast_testing`, and recorded `correct` on `repeated_verification` with a different stimulus note. No second participant answered. The first check stayed `awaiting`. The second returned `verified`. Repeating the same stimulus note returned HTTP 409.
   - The reason text does say “Session-verified inside this session only” and “not a claim of linguistic truth.” The status label is “Session-verified.”
   - Not changed. The audit asked not to weaken or retune the verification rule to make a test pass. Adding a second-person requirement would be a rule change.

2. Planner outcomes do not actually separate the named readings.
   - File: `lib/experiments/select.ts`, `recommendationFrom`.
   - The first outcome always says the first listed reading “stays possible when only the first example matches,” for every theme. The expectation is not derived from which stimulus would be true under which reading. The completeness check still passes because every cell is non-empty.
   - A single reading produces no recommendation. That part held for the benchmark’s `single-reading` case.
   - Not rewritten. Replacing the template would be a new planner, not a small repair.

3. Research and general sessions are not blinded.
   - File: `lib/experiments/privacy.ts`, `seesResearchPlan`.
   - If `purpose` is not `community`, both seats, and anyone who knows the code, receive hypotheses, notes, mappings, and quality text. Unauthenticated export still includes those sessions. Community export no longer does, unless the caller is that session’s facilitator.
   - A volunteer pair that creates a general or research session does not get the community privacy boundary.

### Medium

4. The session index is unauthenticated.
   - Route: `GET /api/sessions`. File: `lib/domain/session.ts`.
   - The probe’s session code appeared in the list. The facilitator note did not. On one computer this is the local dashboard. On a shared or networked server it publishes every session code, name, and participant name.

5. A known hypothesis id can still be accepted by Participant B.
   - Route: `POST /api/sessions/[code]/hypotheses/[id]`. File: `lib/domain/discovery.ts`.
   - After the event fix, B’s session JSON did not contain the id or the wording. Supplying the id from the facilitator’s own create response still returned HTTP 200 and status `tentative`. A wrong id returned 404. A token from another session returned 403 on the session read. Joining a second facilitator returned 409.
   - Left in place because the existing community journey uses the participant token to accept an id the facilitator has already produced. The UI does not show that id to the participant.

6. Live planning consent is narrower than the payload.
   - Files: `lib/ai/plan.ts`, `lib/domain/plans.ts`, `components/experiments/engine.tsx`.
   - Evidence descriptions, notes, and annotations are omitted unless `consentToAnalyze` is true. Media bytes are not attached to a plan request. The system prompt tells the model the user text is untrusted.
   - Hypotheses and locked independent readings are still included when the facilitator checks the share box. The checkbox only mentions descriptions that already have analysis consent. There is no separate confirmation from the other participant.
   - This path was not executed against a provider. No key is configured.

7. The older community suggestion can still name the readings.
   - File: `lib/community/selector.ts`. The unfamiliar-reading branch puts the participants’ own words into the prompt. The community card shows that prompt to the facilitator, and after approval the participant sees the prompt. That can tell the participant which readings are on the table.
   - A failed live call on this older path used to be replaced with the rule draft and recorded as a normal rule result. That replacement now throws and does not save a recommendation. Demo mode still returns the rule draft directly, with `simulated: false` and `source: "rules"`. The Checks page labels `source: "rules"` as simulated. The community card only says “Source: rules.”

8. The neutrality check is a word match, not a reading of the instruction.
   - File: `lib/experiments/quality.ts`.
   - The object-versus-substance visual instruction still says “the empty container” and “the container holding liquid.” It is marked weak, and it is not the highest-scoring recommendation. The highest-scoring prompt does not contain “container.”
   - The same check marks a recommendation weak when any word longer than four letters from a reading appears in the prompt. “Person” inside “the other person” is enough. That is a flag, not a proof of leading language. Scores are not probabilities.

9. Practice responses expose whether an answer was marked correct.
   - File: `lib/domain/serialize.ts`, activities. The answer key is removed for a community participant. The `correct` flag on each practice response is not. This is outside the blinded experiment reply, but it can show the expected choice after someone answers.

### Low

10. The experiment reply buttons can submit a canned sentence.
    - File: `components/experiments/engine.tsx`. “It matches,” “It does not match,” and “We disagree” send those phrases when the text box is empty. “We disagree” is available before the other response is visible. The buttons name a stance the participant may not have reached.

11. The page header tells both people that a check exists to separate two readings.
    - That does not reveal which reading, but it tells a first-time participant that the task is a discrimination test.

12. Two overlapping plan requests can both pass the “no open proposal” check before either insert.
    - File: `lib/domain/plans.ts`. A retry inside one live call cannot save twice, because saving happens only after a valid plan returns. Two simultaneous requests can. A failed live plan records `plan.failed` and saves nothing.

13. `redactSecrets` does not scrub a raw API key unless it appears as a bearer token, a database URL, or a JWT.
    - File: `lib/api/handlers.ts`. The planning and analysis code does not log the request body, the key, or the model response. `HttpError` responses are not logged.

## 3. Fixes applied

- `lib/community/visibility.ts`: comparison opens only after two different people have locked. Advancing the task to “test” no longer reveals the one locked response. Regression in `tests/community.test.ts`.
- `lib/experiments/privacy.ts` and `lib/domain/serialize.ts`: a community participant no longer receives hypothesis wording, hypothesis ids, check results, or recorded outcome sentences in the event list. Regression in `tests/audit-privacy.test.ts`.
- `lib/domain/research.ts`, `app/api/research/route.ts`, `app/api/research/export/route.ts`: community hypotheses, notes, evidence descriptions, stimulus keys, response notes, and relationship notes are removed unless the caller’s token is that session’s facilitator. The research page sends the stored token when a code is open. Research and general sessions are unchanged.
- `lib/community/propose.ts`: when a live key is configured, a failed discrimination request throws. It does not save the rule draft. Demo mode is unchanged. Regression in `tests/audit-privacy.test.ts` with a mocked HTTP 429.
- `lib/experiments/quality.ts`: an instruction that repeats a content word from a competing reading is marked weak. The object-versus-substance ranking test checks that the top recommendation does not say “container,” and that the visual alternative still does and is weak.

## 4. Experiment benchmark

The 12 fixed scenarios were run through the deterministic planner and the checklist. This does not measure language understanding and was not sent to a model.

| Scenario | Planner | Best checklist | Flag |
| --- | --- | --- | --- |
| Object versus substance | Sufficient, novel stimulus | 8/8 | Weaker alternative still says “container” |
| Action versus object | Sufficient, novel stimulus | 8/8 | Weaker alternative echoes “drinking” or “action” |
| Direction versus destination | Sufficient, novel stimulus | 8/8 | Clear |
| Possession versus ownership | Sufficient, novel stimulus | 8/8 | Clear |
| Person versus relationship | Sufficient, novel stimulus | 8/8 | Weaker alternative shares the word “person” |
| Quantity versus intensity | Sufficient, novel stimulus | 8/8 | Clear |
| Gesture versus action | Sufficient, novel stimulus | 8/8 | Weaker alternative echoes “gesture” |
| Sound versus environmental noise | Sufficient, novel stimulus | 8/8 | Weaker alternative echoes “sound” |
| Request versus a name | Sufficient, novel stimulus | 8/8 | Weaker alternative echoes a reading word |
| Place versus object | Sufficient, novel stimulus | 8/8 | Clear |
| One reading only | Insufficient, no recommendation | 0/8 | No invented second reading |
| Repeated water stimulus | Sufficient, novel stimulus | 8/8 | The repeated container examples are not the top check |

The checklist did not describe the score as a probability or as information gain.

## 5. What the privacy probe showed after the fixes

Temporary community session, then deleted:

- Participant and anonymous `GET /api/sessions/[code]`, and participant sync, did not contain the facilitator note, the hypothesis wording, or “stays possible.” Hypothesis count was 0. Note count was 0.
- Participant and anonymous hypothesis export did not contain that wording. The facilitator’s own export did.
- After one person locked “PRIVATE-BODY” and a check was suggested, the participant payload still had an empty body, an empty prompt, empty outcomes, and empty quality notes.
- Participant plan request returned HTTP 403.
- A foreign recovery key returned HTTP 403. A second claim on the facilitator seat returned HTTP 409.
- `GET /api/sessions` listed the session code and did not list the note.

The two-browser experiment journey again found the mapping hidden from the second browser.

## 6. AI provider

Inspected `lib/ai/plan.ts`, `lib/ai/openai-provider.ts`, `lib/ai/config.ts`, and `lib/ai/index.ts`.

- The browser status object names the mode and a disclosure. It does not include a key. No client component reads `OPENAI_API_KEY`.
- Demo mode never calls the network. A live plan without the share confirmation returns HTTP 403 and saves nothing. A missing key returns HTTP 503 and does not substitute a demo plan.
- Invalid JSON, a schema mismatch, HTTP 429, HTTP 5xx, and a timeout are retried once inside the same request. The error says no simulated plan was substituted. Nothing is written until the plan validates. The server then overwrites any model-supplied quality score.
- Analysis can send an image or a wav/mp3 only with analysis consent, a size and type check, and, for audio, `OPENAI_AUDIO_MODEL`. Video and gesture files are not sent. Planning never attaches bytes.
- The older community proposer was the one path that silently substituted rules. That substitution is removed for a configured live provider.
- No configured key was present, so none of this was executed against OpenAI or another host. Mocked responses covered the 429 and invalid-plan cases in unit tests.

## 7. Usability

A first-time community pair can see the next situation, the share code, and the sentence that a response stays hidden until both people lock. The participant experiment screen shows the instruction, not the question the facilitator is using it to answer, and not what an unresolved result would mean. Those details stay on the facilitator side by design. The facilitator does see why a recommendation was ranked, which alternative is weaker, and the line that one result does not session-verify.

“Session-verified” is distinct from “Tentatively accepted,” “Under verification,” “Disputed,” and “Reopened.” The reason stored on the concept says the result can be reopened and is not linguistic truth. The interface does not say that the other person must have answered.

Leading pressure that remains: the visual water instruction, community prompts that quote the participants’ words, and the one-click “It matches” / “We disagree” buttons.

## 8. Tests run

- 67 unit tests passed, including the new privacy, ranking, verification, and live-fallback tests.
- TypeScript passed.
- ESLint passed with no warnings.
- Production build passed.
- Health returned HTTP 200, `mode=demo`, database connected.
- Smoke, the reliability journey, the community journey, and the HTTP experiment journey passed on port 3010.
- The two-browser experiment journey passed.
- The API probe above passed after the fixes. Its sessions were deleted.
- Afterward, SQLite contained only `SHORE-1001`, with 8 concepts.

## 9. Untested

- No real model request. Timeout, rate limit, and malformed JSON were mocked or inspected in code.
- Production Postgres, Supabase Storage, and the deployed site were not exercised.
- The server was bound for local use. This audit did not scan it from another machine.
- Research and general sessions were not re-blinded. Their full export remains available without a facilitator token.

## 10. Controlled volunteer testing

Not yet, if the pair needs privacy against anyone but themselves, or if session-verified is going to be read as both people agreeing.

A supervised local community session is usable as a demo of the workflow: show something, answer separately, compare, and keep a simulated check distinct from a verified meaning. Before a real pair relies on it, the second person should have to take part in verification, research and general sessions should get the same export boundary as community sessions, and the planner should stop offering the container instruction even as a weaker alternative.
