# Global AI Builder's Challenge — rubric evidence

Prepared 28 November 2026 from the public rubric at [global-ai-builders-challenge.devpost.com/resources](https://global-ai-builders-challenge.devpost.com/resources). The rubric has 25 checks. Each check is scored only when the submission shows the requirement. This file does not award points. It records what was observed, where, and what was not shown.

No application code was changed for this note. No tests were rerun. The source reports below were removed from the working tree in commit `511aa82`. Their text is in commit `5a3683e`:

- `FINAL-JUDGING-READINESS-REPORT.md`
- `PHASE-1-PRODUCTION-READINESS-REPORT.md`
- `PHASE-1-SECURITY-CLOSURE-REPORT.md`
- `PHASE-2-WORKFLOW-VALIDATION-REPORT.md`
- `LIVE-AI-EVALUATION-REPORT.md`

`HACKATHON-DEMO-SCRIPT.md` and `docs/screenshots/01` through `06` are still in the tree. The live site is https://first-contact-language-builder.vercel.app.

## AI disclosure

Four different things have been called "AI" in this project. They are not interchangeable.

| Kind | What it is | What was actually observed |
| --- | --- | --- |
| 1. AI in the deployed application | Production `AI_PROVIDER` is `demo`. Health on 27 November 2026 reported `ai.mode` `demo`. `POST /api/sessions/WIND-5250/analyze` returned HTTP 200 with `simulated: true`. The page says hypotheses are simulated from the written description, the evidence type, and the action label, and that no model inspects the image, drawing, or audio. | Production, simulated. |
| 2. Optional live provider in code | `lib/ai` calls an OpenAI-compatible endpoint only when `AI_PROVIDER=openai` and `OPENAI_API_KEY` is set. Consent is required before a file is sent. A failed live plan is not replaced with a demo plan. The code does not set a concept to session-verified. | Present in the repository. Not called against a commercial model. No Preview deployment with a real key. |
| 3. Simulated demo output | The demo provider and the community rule selector (`source: "rules"`) propose readings and a follow-up check from text and labels. | This is what production and the screenshots show. |
| 4. AI-assisted development | Cursor was used to write, review, and change code during 21–28 November 2026. No Antigravity session, prompt, or diff is recorded in the repository or in the reports read for this file. | See A4. Do not describe unrecorded Antigravity work. |

The local command `npx --yes tsx scripts/evaluate-ai-provider.mjs` scored 8/8 against a mock HTTP server on `127.0.0.1`. That run checks request shape, consent stripping, JSON parsing, retries, timeouts, and fail-closed errors. It is not an evaluation of a live model's answers.

### Cursor work that a person checked

| Contribution | Check | Finding | Decision |
| --- | --- | --- | --- |
| Community privacy, commit `5a3683e` (28 November 2026) | `tests/experiment-engine.test.ts` and `tests/access-control.test.ts`, 17 tests, exit 0. Not rerun for this note. | A community participant could see the hidden-hypothesis count, request readings, and delete the other person's evidence. | Kept. Facilitators still see the count and can request readings. Each person can still delete their own evidence. Pushed to `main`. |
| Production create returned HTTP 400 | One Playwright retry after waiting for the form to keep its values. | The first script submitted before React stored the name and the consent checkbox. The server message matched an empty name and `consent` not true. After the form held the values, create returned HTTP 201. | Validation was not weakened. |
| Node `fetch` join with no HTTP status | Vercel request logs for that window. | The join never appeared in the logs. A later browser join returned HTTP 200. | No application change. |
| README rewrite, commit `511aa82` | The file was edited from the previous README. Commands and environment names were kept. | Internal phase reports were removed from the tree in the same commit. | Kept, at the author's request. |

## V1 — Is there a real need, and does the project address it? — 8 points

**Requires:** Credible evidence of a specific need (4). A realistic example of the main capability addressing that need (4).

**Demonstrates:** The intended users are two people who do not already share a language and want to record what they show each other. The concrete situation used throughout the demo is a photo or gesture that could mean the liquid, the container, the action, or a request. The app gives each person a seat, keeps competing readings unlabeled as fact, hides the other person's draft until both lock, and withholds session-verified until two people match across two stimuli and two methods.

**Support:** `HACKATHON-DEMO-SCRIPT.md` sections 1–2. Screenshots `03-discovery-hypotheses.png`, `04-experiments-blinded.png`, `05-experiments-revealed.png`. Production session `BROOK-2322` in the Phase 2 report at `5a3683e`.

**Evidence class:** The product behavior is production. The need itself is an illustrative scenario written into the demo. `SHORE-1001` is labeled sample data, not fieldwork.

**Limitation:** No outside user comment, firsthand field note, or published source is in the repository. No human participant study was run. The first V1 check is not supported by an independent source.

## V2 — Does the project offer a supported advantage? — 8 points

**Requires:** A comparison with a reasonable current method, with the source of the comparison stated (3). Evidence of a specific benefit (5).

**Demonstrates:** A usual alternative is a translation app or a single-user chat that assumes the target language is known and returns one reading. This app's recorded difference is procedural: two seats, several open readings, a blinded lock, and a session-only verification rule. Those behaviors were observed on the hosted site.

**Support:** Demo script, problem section. Phase 2 session `BROOK-2322`: four hypotheses, seat B saw zero, accept stayed `tentative`, and a later two-person multi-method check reached `verified`. Screenshot `03` shows competing guesses. The comparison facts come from this application's observed behavior and from the category description in the demo script. They do not come from a timed comparison against a named translator.

**Evidence class:** Production for this app's behavior. The comparison is descriptive, not a head-to-head test.

**Limitation:** No measured time, cost, or accuracy advantage against another product. Saying the protocol is more careful is an argument from the product's rules, not a user study.

## V3 — Could the intended users realistically use the project? — 4 points

**Requires:** The proposed use is workable with the equipment, information, permissions, and operating resources it needs (4).

**Demonstrates:** Two browsers, a session code, a display name, and the shared-discovery confirmation. No account. The hosted app is public at the URL above. Local use needs Node, `npm install`, and `npm run db:setup`, as in `README.md`. Files stay in a private bucket in production and are served only to a seat in that session.

**Support:** `README.md` install and production sections. Production health HTTP 200 with PostgreSQL, private storage, signed media, and database rate limiting, recorded in the 27 November judging report. Phase 1 security report: legacy sample tokens rejected on the hosted site, public bucket URL rejected, signed media returned HTTP 200.

**Evidence class:** Production for the hosted path. Local install is documented and was built; this note does not rerun it.

**Limitation:** Each seat's recovery key is in that browser's local storage. Losing it leaves the seat reserved. The app needs a network connection to the hosted site. It is not an offline field kit.

## A1 — Is the selected AI a justified choice? — 6 points

**Requires:** A reason the chosen method fits the job (3). Comparison or test evidence that the difference matters for this project (3).

**Demonstrates:** The method that actually runs in production is the demo hypothesis engine. It is used because the job is to propose several readings and one follow-up check without deciding the meaning, and because no live provider key is configured. The optional OpenAI-compatible path is for the same job when a key exists: consented text, and consented images only within the size and type limits in `README.md`.

**Support:** Health `ai.mode` `demo`. `WIND-5250` analyze `simulated: true`. `LIVE-AI-EVALUATION-REPORT.md` at `5a3683e` states that no live external model call was made. The mock harness shows the live code path omits unconsented text and does not substitute a demo plan on HTTP 429, 500, malformed JSON, schema mismatch, or timeout.

**Evidence class:** Production for demo mode. Mock for the live path's failure behavior. Untested for live answer quality.

**Limitation:** There is no comparison of recognition quality, cost, or latency against another model on this task. A claim that a named model is "better" would not be supported. The mock result must not be described as model-quality evidence.

## A2 — Has the team made an effective project-specific AI choice? — 10 points

**Requires:** An implemented design choice for a project-specific problem (4). Evidence that the choice contributes to the goal (6).

**Demonstrates:** Three choices are in the running app, not only in a plan.

1. Several readings stay open. Accepting one leaves it tentative. Session-verified is a separate rule in `lib/verification` and is not set by the model code.
2. In a community session, the participant seat does not receive the hypothesis list. Commit `5a3683e` also hides the open-hypothesis count, blocks that seat from requesting readings, and blocks deleting the other person's evidence.
3. Unconsented written fields are blanked before a live planning request. Production demo mode does not send file bytes.

**Support:** `BROOK-2322`: `hypsA=4`, `hypsB_blinded=0`, accept `tentative`, check `9c` `verified` only after the two-person rule. `WIND-5250`: Hypotheses (4) versus (0), panel did not say a live model ran and did not say the readings were session-verified. Screenshots `03`, `04`, and `05`. Mock case 1: the string `SECRET UNCONSENTED TEXT` was absent from the outgoing body.

**Evidence class:** Production for isolation, tentative acceptance, and the demo label. Mock for consent stripping on the live request path. Local tests for the privacy helpers, already run before `5a3683e`, not rerun here.

**Limitation:** The production contribution is from the demo engine and the access rules. It does not show that a live model produced a better reading.

## A3 — Has the team meaningfully checked AI quality and its limits? — 8 points

**Requires:** A check of the project's AI work against a stated requirement, with the method and the actual results (4). An account of when those results can and cannot be relied on, specific to this project (4).

**Demonstrates:** The check that was run against production is a labeling and behavior check, not a correctness check. Requirement: demo output must say it is simulated, must not inspect media, and must not session-verify a concept by itself. Result on 27 November 2026: health `demo`; analyze HTTP 200 `simulated: true`; seat A saw four open hypotheses; seat B saw none; the panel did not claim a live model or session verification.

The 8/8 harness checks a different requirement: the live adapter fails closed and strips unconsented text. Method: local mock server, `scripts/evaluate-ai-provider.mjs`. Result: 8/8. That does not say a model's suggested meaning was right.

**Support:** Judging-readiness report, section 5 and section 8. Live AI report, sections 1–4. Demo script, section 6.

**Evidence class:** Production for the demo-label check. Mock for the adapter contract. Untested for linguistic quality.

**Limitation:** No live model was scored against a reference meaning. Session-verified means the session's own numeric rule was met. It is not evidence that the meaning is true outside that session. Video is not sent for analysis. Audio is not sent unless a separate audio model is configured and the file is wav or mp3 with consent. Browser recordings are often webm, so they stay stored.

## A4 — Was AI-assisted development checked by a person? — 6 points

**Requires:** A person checked a specific AI contribution made during the event (3). The check's finding led to keeping, changing, or rejecting that work (3).

**Demonstrates:** Cursor proposed and edited the community privacy fix. A person asked for the bug fix and for the commit. The focused tests passed, 17 of 17, and the change was kept in `5a3683e`. Separately, an AI-written browser script produced a false HTTP 400 by submitting before the form stored its values. The check was a second browser attempt after hydration. The server then returned HTTP 201 with the name and consent intact. The validation code was rejected as the thing to change.

**Support:** Commit `5a3683e`. Judging-readiness report, sections 1 and 2, as updated in that commit. The test command was `npx vitest run tests/experiment-engine.test.ts tests/access-control.test.ts`.

**Evidence class:** Local tests for the privacy change. Production browser for the form check. The author is Sharma, and the commits are on `main`.

**Limitation:** Antigravity is not evidenced here. Do not invent a review of Antigravity output. The 17 tests were not rerun while writing this file.

## R1 — Is the complete main process working? — 6 points

**Requires:** The submitted project carries the main process from the starting action to the final output, and the demo discloses manual steps or special conditions (6).

**Demonstrates:** On production session `BROOK-2322`, the Phase 2 script created a community session, joined from a second browser, saved evidence from both seats, showed four hypotheses to seat A and none to seat B, approved a discriminating check, kept drafts hidden until both locked, revealed both responses, blocked a participant from accepting (HTTP 403), left an accepted hypothesis `tentative`, and reached `verified` on the two-person, two-stimulus, two-method check (`9c`). Cleanup returned HTTP 200 and a following read returned 404. `SHORE-1001` still had 8 concepts.

**Support:** Phase 2 report, table in section 2, run `task-1173`. Screenshots `01` through `05`. Demo script beats 1–3.

**Evidence class:** Production.

**Limitation:** The same run did not finish `10c`, `10d`, or `10e`. The 27 November pass on `WIND-5250` stopped with `net::ERR_TIMED_OUT` before the community lock step. That later pass did not complete the main process. Screenshot `06` is not the verified result. The demo script already says so.

## R2 — Are the results correct across relevant situations? — 16 points

**Requires:** Two ordinary examples (3 + 3), one repeat (4), and one more demanding allowed example (6). For each, state what should happen and what happened.

The full table is in the next section. Short map:

| Check | Result | Class |
| --- | --- | --- |
| Ordinary example 1 | `BROOK-2322`: image and gesture, four open hypotheses, other seat blind, accept stays tentative. | Production |
| Ordinary example 2 | `WIND-5250`: written notes instead of a photo and a gesture. Analyze `simulated: true`. Hypotheses (4) and (0). Demo banner visible. | Production |
| Repeat | `WIND-5250` repeated the hypothesis-isolation result of `BROOK-2322`. Create-and-join also succeeded again on `MARSH-3890` (HTTP 201 and HTTP 200). | Production |
| Demanding example | `BROOK-2322` check `9c`: two participants, more than one stimulus, more than one method, `status=verified`. | Production |

**Limitation:** `10c` returned `status=undefined` and was not isolated. `10d` (disagreement) and `10e` (match rate under 75%) were not run because vocabulary navigation timed out. Do not describe those as passed. Do not describe the 27 November lock step as completed. Local unit tests covered threshold cases earlier (90 tests in the Phase 2 report). That is local evidence, not the hosted run, and it was not rerun for this file.

## R3 — Are different kinds of failure handled safely? — 8 points

**Requires:** Two failures with different causes, each detected and handled so earlier valid work remains (4 + 4).

| Cause | What happened | Class |
| --- | --- | --- |
| User action: create submitted without a display name and without consent | HTTP 400. Body: "Enter a display name. Confirm that this session is for shared discovery, not emergency or professional interpretation." No session was created. A later valid submit on the same form returned HTTP 201. | Production. Judging-readiness report. |
| Service pressure: repeated requests over the limit | HTTP 429 within 17 requests, `Retry-After: 638s`. The Phase 1 live suite then deleted only its throwaway sessions. | Production. Security closure report, check 5 of the 13. |

**Also recorded, not a substitute for the two causes above:**

- Unsigned, tampered, or expired media returned HTTP 404. A public bucket URL returned HTTP 400. A cross-session read returned HTTP 404. Production, same security suite.
- Mock model failures: malformed JSON and schema mismatch returned HTTP 502, HTTP 429 was retried once then returned 429, HTTP 500 returned 502, and a stalled request returned HTTP 504. The report states no demo plan was substituted. Local mock only.

**Limitation:** `net::ERR_TIMED_OUT` on `/session/WIND-5250/community` is a dropped browser connection. It is not a handled application failure. The lock step did not run. `10c` returning `status=undefined` is an unfinished observation, not a demonstrated safe stop.

## Results table for R1–R3

| Scenario | Expected behavior | Actual result | Environment | Evidence |
| --- | --- | --- | --- | --- |
| Ordinary: two browsers, photo plus gesture | Both evidence items saved. Several open hypotheses. Other seat does not see them. Nothing auto-verified. | `BROOK-2322`. Evidence HTTP 201 and 201. `hypsA=4`, `hypsB_blinded=0`, `concepts=0`. | Production | Phase 2 report, `task-1173`. Screenshot `03`. |
| Ordinary: two browsers, written notes | Same isolation. Output labeled simulated. | `WIND-5250`. Both notes HTTP 201. Analyze HTTP 200, `simulated: true`. Hypotheses (4) and (0). Banner stated demo mode. | Production, 27 November 2026 | Judging-readiness report, section 5. |
| Repeat of isolation | A later session shows the same seat split. | `WIND-5250` matched the `BROOK-2322` split of four versus zero. | Production | Both reports above. |
| Repeat of create and join | A new code creates and a second browser joins. | `MARSH-3890` create HTTP 201, join HTTP 200, both seats visible. `FIELD-4184` also created and was later deleted (DELETE HTTP 200). | Production | Judging-readiness report. |
| Demanding: two people, two stimuli, two methods | Status becomes session-verified only when that rule is met. | `BROOK-2322` check `9c`, `status=verified`. Earlier, one person meeting the numbers stayed `awaiting` (`10a`). One stimulus stayed `awaiting` (`10b`). Accept stayed `tentative` (`9b`). Participant accept returned HTTP 403 (`9a`). | Production | Phase 2 report. |
| Blinded lock and reveal | Hidden until both lock, then both responses visible, outcome map still hidden. | `BROOK-2322`: hidden before lock, hidden after one lock, `revealed=true`, `outcome_mappings_hidden=true`. | Production | Phase 2 report. Screenshots `04` and `05`. |
| Single method across two stimuli | Should stay unverified. | `status=undefined`. The non-2xx response was not isolated. Run stopped. | Production, incomplete | Phase 2, check `10c`. Not a pass. |
| Disagreement, and match rate under 75% | Disputed, and not verified. | Not run. Vocabulary navigation hit `net::ERR_TIMED_OUT`. | Production, untested | Phase 2, `10d` and `10e`. Screenshot `06` is `BROOK-1509`, three cards marked accepted, not session-verified. |
| Latest community lock | Both seats lock, then the readings show. | Not reached. `page.goto` community returned `net::ERR_TIMED_OUT`. | Production, incomplete | Judging-readiness report. Do not claim this run finished. |
| Missing name and consent | Clear rejection, no session. | HTTP 400 with the display-name and shared-discovery message. | Production | Judging-readiness report, first Playwright attempt. |
| Too many requests | 429, retry hint, existing records kept. | HTTP 429, `Retry-After: 638s`, within 17 requests. | Production | Phase 1 security closure, live check 5. |
| Bad or stalled model HTTP | Fail closed. No simulated substitute. | 502, 429, 502, and 504 as listed in the live AI report. 8/8 on the mock server. | Local mock | `LIVE-AI-EVALUATION-REPORT.md` at `5a3683e`. Not a live model. |

## D1 — Is the main action or information easy to recognize? — 4 points

**Requires:** Primary actions and the important information stay distinct from optional detail across the main path (4).

**Demonstrates:** The landing screenshot shows the demo-mode disclosure. The start screenshot is the create and join step. The hypothesis screenshot is the competing readings. The experiment screenshots show the hidden state and then the revealed state. The demo script uses that order.

**Support:** `docs/screenshots/01-landing.png` through `05-experiments-revealed.png`. `HACKATHON-DEMO-SCRIPT.md` beats 1–3.

**Evidence class:** Production screenshots. No separate usability test.

**Limitation:** Screenshot `06` is easy to misread because the filename says verified. The cards are accepted, not session-verified. The demo script says that. A judge should not be told otherwise.

## D2 — Does the experience have a coherent, finished design? — 4 points

**Requires:** Type, spacing, color, controls, and labels stay consistent, including error or completion states that appear (4).

**Demonstrates:** The field-notebook interface is the one in the screenshots and on the hosted site after commits `4fb3e7e`, `57c2e7d`, and `e610aac`. The same session chrome is used for discovery and experiments. Demo mode uses one disclosure sentence rather than a separate visual language.

**Support:** Those screenshots and commits. Production pages loaded during the Playwright passes.

**Evidence class:** Production screenshots. Design consistency was not scored with a checklist in the source reports.

**Limitation:** This file does not claim a visual audit beyond the six screenshots and the pages the browser passes opened. The community page on the last pass did not load.

## D3 — Does the design remove unnecessary user effort? — 4 points

**Requires:** A demonstrated choice removes a specific burden, while needed controls stay reachable (4).

**Demonstrates:** The second person joins with the session code and a name. There is no account. Community sessions start from a task template, including "Asking for an everyday item," instead of writing the protocol from scratch. Both browsers poll the same session, so the second person does not exchange files by hand.

**Support:** Demo script beat 1. README, shared session state. `BROOK-2322` and `WIND-5250` both used that join path. Judging-readiness report, community template named in the suggested demo flow.

**Evidence class:** Production for code join and the two-browser sessions.

**Limitation:** No before-and-after timing. The recovery key still has to be kept by the browser. A stalled page still needs a reload. The last community navigation did not recover inside that pass.

## D4 — Does the presentation help users find and understand information? — 8 points

**Requires:** Information for the task is grouped or labeled (3). A useful relationship is visible without reconstructing it from a raw dump (5).

**Demonstrates:** Hypotheses are separate from evidence and from the verification status. Screenshot `03` shows several guesses together, each still a guess. Screenshots `04` and `05` show the same check before and after both locks, which is the relationship the protocol depends on. The vocabulary screenshot groups entries with a status line. On `BROOK-1509` that line is "Accepted, not session-verified."

**Support:** Screenshots `03`, `04`, `05`, and `06`. Phase 2 rows `6a`, `6b`, `7 & 8`, and `9b`.

**Evidence class:** Production screenshots and the `BROOK-2322` workflow.

**Limitation:** The side-by-side of a session-verified card and an accepted card was not captured. The recapture timed out.

## Hackathon-period commits

The public history starts at `453ff8f` on 21 November 2026. The event window used here is 21–28 November 2026.

| Commit | Date | What it adds for a judge |
| --- | --- | --- |
| `453ff8f` | 21 Nov | Initial application in the repository. |
| `692cebb` | 24 Nov | Community access for two people. |
| `572fe5d` | 25 Nov | Experiment planning and seat checks. |
| `4fb3e7e`, `57c2e7d`, `e610aac` | 26–27 Nov | Field-notebook interface. |
| `924c914` … `9ea5af7` | 26–27 Nov | Hosted Postgres, private storage, rate limits, RLS, Data API off. |
| `58b1b14` | 27 Nov | Workflow script, mock AI harness, screenshots, demo script. |
| `5a3683e` | 28 Nov | Community participant cannot see or change the other seat's hidden research records. |
| `511aa82` | 28 Nov | README rewritten. Internal reports removed from the tree. |

## What this file will not say

- That a live model read an image, a drawing, or audio.
- That the 8/8 mock run measured answer quality.
- That `10c`, `10d`, or `10e` passed.
- That the 27 November community page finished the lock step.
- That screenshot `06` shows a session-verified vocabulary.
- That a user study or an outside tester exists.
- That Antigravity contributed a recorded change.
