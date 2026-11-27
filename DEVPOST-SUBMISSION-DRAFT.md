# Devpost submission draft

Project: First-Contact Language Builder  
Live app: https://first-contact-language-builder.vercel.app  
Repository: https://github.com/sharmao07/first-contact-language-builder  
Team: Ojus Sharma, solo.  
Event window used below: 21–28 November 2026. The public Git history starts with `453ff8f` on 21 November 2026.

This draft answers the five questions on the [Global AI Builder's Challenge](https://global-ai-builders-challenge.devpost.com/) page. Supporting detail is in `GLOBAL-AI-RUBRIC-EVIDENCE.md`. The phase reports cited there remain in git at commit `5a3683e` and are not in the current tree.

Demo video outline, 2–4 minutes: landing disclosure, create and join, two pieces of evidence, four simulated hypotheses on seat A and none on seat B, then the blinded lock and reveal from screenshots `04` and `05` / session `BROOK-2322`. Say that production is demo mode. Do not show screenshot `06` as a verified vocabulary. If the community page stalls, stop on the hypothesis split.

No sponsor award is claimed. Momen and Prune were not used.

## 1. Who is it for, and why would they use it?

It is for two people who do not already share a language and still need to work out what a picture, a gesture, or a note is pointing at. The situation used in the demo is ordinary and ambiguous: cupped hands near a vessel can be the liquid, the container, the act of drinking, or a request. A translation app needs a known target language and usually returns one reading. This app opens a session code, gives each person a seat, and keeps several readings open until the people in that session check them.

What the hosted app showed: on production session `BROOK-2322`, both people submitted evidence, seat A saw four hypotheses, seat B saw none, an accepted reading stayed tentative, and a later check with two people, two stimuli, and two methods reached session-verified. Session-verified applies only inside that session. It is the session's rule, not a claim that the meaning is true in general.

The need is illustrated by that water / cup / drinking case in the demo script. There is no cited field study and no outside user comment in the repository. `SHORE-1001` is sample data, not fieldwork.

Someone can use the hosted site with two browsers, a name, the shared-discovery confirmation, and the session code. There is no account. Local setup is in `README.md`.

## 2. What did the team build or improve during the hackathon?

The public repository begins on 21 November 2026. The work below is what landed during 21–28 November.

- Two-seat sessions, evidence, hypotheses, blinded responses, and the session-verified rule (`453ff8f` through `572fe5d`, including community access in `692cebb`).
- The field-notebook interface (`4fb3e7e`, `57c2e7d`, `e610aac`).
- Hosted PostgreSQL, a private storage bucket, signed media, database rate limiting, row-level security on the public tables, and the Supabase Data API turned off (`924c914` through `9ea5af7`). The Phase 1 security report records a 13-check production pass after those changes, including HTTP 429 on the rate limit and rejection of unsigned media.
- A two-browser production workflow, screenshots, and a demo script (`58b1b14`).
- A privacy fix so a community participant cannot see the hidden-hypothesis count, request readings, or delete the other person's evidence (`5a3683e`).
- A README written for a judge, with the internal phase reports removed from the tree (`511aa82`).

Third-party pieces are Next.js, React, Prisma, Supabase, and Vercel. The session rules, the two-seat privacy, and the demo-versus-live split are this project's code.

## 3. How did the team use AI?

### In the finished project

The deployed app runs in demo mode. On 27 November 2026, `GET /api/health` reported `ai.mode` `demo`. In session `WIND-5250`, `POST /api/sessions/WIND-5250/analyze` returned HTTP 200 with `simulated: true`. The page says the hypotheses come from the written description, the evidence type, and the action label, and that no model inspects the image, drawing, or audio.

That method fits the job that is actually running: propose more than one reading and a follow-up check, and leave the decision to the people in the session. A live model is optional. The code calls an OpenAI-compatible endpoint only when `AI_PROVIDER=openai` and a server-side key are both set. Files are eligible only after consent. A failed live call is not replaced with a demo plan. The model path does not mark a concept session-verified.

The project-specific choices that are built and were observed:

- Several hypotheses stay open. Accepting one left the concept `tentative` on `BROOK-2322`.
- The other seat does not see those hypotheses. `BROOK-2322` recorded `hypsA=4` and `hypsB_blinded=0`. `WIND-5250` showed Hypotheses (4) and Hypotheses (0).
- Community participants, after `5a3683e`, also cannot see the hidden count, request the readings, or delete the other person's evidence.

Quality check that exists: production output is labeled simulated and was not treated as session-verified. A separate local harness, `scripts/evaluate-ai-provider.mjs`, scored 8/8 against a mock HTTP server. It checked consent stripping, JSON parsing, retries, timeouts, and fail-closed errors. It did not call OpenAI, and it did not score whether a suggested meaning was right. No live key and no Preview project were configured. Limits: demo readings do not look at pixels or audio; session-verified is not linguistic truth; webm audio and whole videos are not sent for analysis.

### During development

Cursor was used to edit the repository during the event. Two checks decided what to keep.

The community privacy bug was real: a participant seat could see the hidden count, request readings, and delete the other person's evidence. Focused tests `tests/experiment-engine.test.ts` and `tests/access-control.test.ts` passed, 17 tests. The fix was kept and pushed as `5a3683e`.

A production create returned HTTP 400. The browser script had submitted before the form stored the name and the consent checkbox. After the form held those values, create returned HTTP 201. The validation was left as it is.

No Antigravity contribution is recorded in the repository or in the reports used for this draft. None is claimed.

## 4. How can people access it, and what results does it achieve?

Open https://first-contact-language-builder.vercel.app. Create a community session with a name and the shared-discovery confirmation. Join the code from a second browser. Submit evidence from each seat. Ask for hypotheses on the facilitator seat. The other seat should not see them. A successful hypothesis step shows several open readings, a demo-mode label, and no session-verified badge.

Requirements: a current browser, internet, and a display name. No account and no fee for the hosted demo. The hosted app uses Vercel, Supabase PostgreSQL, and a private Supabase bucket. Local run: `npm install`, `npm run db:setup`, `npm run dev`, then http://localhost:3000. Details and environment names are in `README.md`.

The main task is complete when two people have a shared record, competing readings stay unchecked, responses stay hidden until both lock, and session-verified appears only after the two-person rule. Judges can score the rows below without running the app. Screenshots: `docs/screenshots/01-landing.png` through `05-experiments-revealed.png`.

| Case | What should happen | What happened | Where |
| --- | --- | --- | --- |
| Ordinary: photo and gesture | Evidence saved. Several open hypotheses. Other seat blind. Not auto-verified. | `BROOK-2322`. HTTP 201 and 201. Four hypotheses versus zero. | Production. Screenshot `03`. |
| Ordinary: written notes | Same split. Labeled simulated. | `WIND-5250`. Both notes HTTP 201. Analyze HTTP 200, `simulated: true`. Hypotheses (4) and (0). | Production, 27 November 2026. |
| Repeat | Another session shows the same split. | `WIND-5250` repeated the four-versus-zero result. `MARSH-3890` create HTTP 201 and join HTTP 200. | Production. |
| Demanding: two people, two stimuli, two methods | Session-verified only when that rule is met. | `BROOK-2322` check `9c`, `status=verified`. One person, and one stimulus, stayed `awaiting`. Accept stayed `tentative`. | Production. |
| Lock and reveal | Hidden until both lock. | `BROOK-2322`: hidden before lock, hidden after one lock, then revealed. Outcome mappings stayed hidden. | Production. Screenshots `04` and `05`. |
| Missing name or consent | Rejected, no session. | HTTP 400 with the display-name and shared-discovery message. | Production. |
| Too many requests | 429, earlier records kept. | HTTP 429, `Retry-After: 638s`. | Production, Phase 1 live suite. |

Design choices a judge can see: the landing page states demo mode before a session starts; join is a code rather than an account; hypotheses, the blinded check, and the revealed check are separate screens so the status is visible. Screenshot `06` is session `BROOK-1509` with three entries marked accepted, not session-verified.

## 5. What are the limits, and what happens when something goes wrong?

Production AI is simulated. No live model call has been made. The 8/8 figure is a mock HTTP contract, not a quality score.

These hosted checks did not finish:

- Single method across two stimuli returned `status=undefined` on `BROOK-2322` (`10c`). It is not a pass.
- Disagreement (`10d`) and a match rate under 75% (`10e`) were not run. Vocabulary navigation timed out.
- On 27 November 2026 the community page for `WIND-5250` returned `net::ERR_TIMED_OUT` before lock and reveal. That run did not complete. Screenshots `04` and `05` are from the earlier `BROOK-2322` capture.

Handled failures that were observed:

- A create without a name and consent returned HTTP 400 and did not open a session. The next valid submit returned HTTP 201.
- Rate limiting returned HTTP 429 with `Retry-After`.
- Unsigned or cross-session media returned HTTP 404. A public storage URL returned HTTP 400.
- On the mock server, malformed model output, HTTP 429, HTTP 500, and a timeout failed closed and did not insert a demo plan. That behavior is not proven against a commercial model.

Other limits: two seats only; the recovery key lives in the browser; there is no account system and no encryption at rest; audio is not translated; a whole video is not analyzed; practice does not watch the participant. No human study was run. `MARSH-3890` and `WIND-5250` may still be in the hosted database because their recovery keys were not kept.

The app does not provide emergency or professional interpretation. The create form asks for confirmation of that before a community session starts.
