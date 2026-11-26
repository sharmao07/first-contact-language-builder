# Post-UI readiness audit

Audited 26 November 2026 from the implementation on `main` at `4fb3e7e`, plus a live read of the local server and the public Vercel health endpoint. The UI was not redesigned. No session was created, reset, or verified. `SHORE-1001` still has 8 concepts and 8 evidence rows.

No isolated P0 defect was found that could be fixed without new infrastructure or a data change. Nothing in the application code was patched for this audit.

## Executive summary

The local application is a working two-seat discovery tool in demo mode. A person can create a session, join the other seat, submit evidence, keep competing readings, run checks, and reach session verification only through the recorded rule. AI output is labeled and does not verify a meaning. That is enough for a supervised local demonstration.

It is not ready for real users on a shared or public server. The public deployment at `https://first-contact-language-builder.vercel.app` returns HTTP 503. Its health report says the database is not connected, storage is still local and therefore refused, and media signing is not configured. Creating a session there returns `The database is not available.` No OpenAI key is configured locally or on that deployment, so no live model call has been made. There is no request rate limit. Join codes are human-scale, not high-entropy secrets.

Local health, read from `http://127.0.0.1:3010/api/health` during this audit:

- `ok: true`, environment `development`, database SQLite connected
- storage local, persistent, under `data/uploads`
- media signed with the built-in development key
- sync transport `stream`
- AI mode `demo`

Public health, read during this audit, HTTP 503:

- database `connected: false`, provider `unknown`
- storage provider `local`, `configured: false`, detail says production cannot keep uploads on local disk
- media `configured: false`
- sync transport `poll`
- AI mode `demo`

## Status vocabulary

- **Implemented:** the path exists, is enforced on the server, and is covered by a unit test or a direct read of this running app.
- **Partial:** the path works in one mode and is missing, weaker, or unproven in another.
- **Simulated:** the software produces the output without a model, a second person, or a real external service. The code says so.
- **Broken:** the public deployment cannot perform the action.
- **Untested here:** not executed in this audit. Earlier reports are not reused as if they were rerun.

## Feature-by-feature status

### 1. Sessions, invitations, join codes, QR, recovery

**Partial. Local create/join/rejoin is implemented. Public create is broken.**

- Create, join, rejoin, leave, and list-by-token live in `lib/domain/session.ts`, with routes `app/api/sessions/route.ts`, `app/api/sessions/join/route.ts`, `app/api/sessions/rejoin/route.ts`, and `app/api/sessions/[code]/leave/route.ts`.
- Codes come from `generateSessionCode` in `lib/session/codes.ts`: one of 21 words plus a number from 1000 to 9999. That is 189,000 codes. A wrong code and a bad token share the body `No session is available for this request.` (`OPAQUE_SESSION` in `lib/access/credentials.ts`). A taken seat returns HTTP 409 and includes the occupant’s display name.
- The seated session shows the code and a QR in `SessionInvite` inside `components/session/frame.tsx`. The QR points at `${origin}/start?code=${code}`. `app/start/page.tsx` sends a community join to `/session/${code}/community`.
- New recovery keys are 48 hex characters from `createToken`, stored as a SHA-256 hash on `AccessCredential`, and expire. Default TTL is 168 hours (`recoveryTtlMs`). Leave sets `leftAt` and `revokedAt`. Rejoin of the current left key renews it.
- Legacy plaintext participant tokens have no credential row and do not expire until leave or rejoin. The illustrative sample seats are created that way in `lib/demo/illustrative.ts`. Those token strings are in the public repository. They open only the seeded sample session, not other sessions.

### 2. Participant A/B separation and independent evidence

**Implemented for seat identity. Partial for blinding outside community sessions.**

- `requireParticipant` in `lib/domain/common.ts` loads the session and the presented key together. A missing session, unknown key, or cross-session key all return the same 404. A left seat returns 403. An expired or replaced key returns 401.
- Evidence, checks, hypotheses, and activities store `participantId`. One seat cannot satisfy the two-author verification rule alone. See `deriveVerificationStatus` in `lib/verification/status.ts`.
- Community sessions hide the research plan, hypothesis text, and unreleased replies from the non-facilitator. `seesResearchPlan` and `presentReplies` are in `lib/experiments/privacy.ts`. Serialization is in `lib/domain/serialize.ts`.
- In a general or research session, `seesResearchPlan` returns true for both seats. Seat B can see the experiment plan, stimulus key, and options. Answer keys for practice stay with the host or community facilitator (`canMutateHypotheses` in `lib/access/policy.ts`).

### 3. Evidence capture, uploads, previews, persistence

**Implemented locally. Broken on the public deployment.**

- The composer in `components/discovery/composer.tsx` supports camera, image, drawing, audio, video, gesture, demonstration, and written note. Demonstration is stored as a gesture. Video requires a file. A note requires a description.
- `addEvidence` in `lib/domain/discovery.ts` checks the seat, rejects SVG and unknown MIME types, and enforces `MAX_IMAGE_BYTES`, `MAX_AUDIO_BYTES`, and `MAX_VIDEO_BYTES` (defaults 8 MB, 10 MB, 25 MB in `.env.example`). Files are written through `lib/storage/index.ts`. Local files go to `data/uploads/<sessionId>/`.
- `GET app/api/media/[id]/route.ts` serves a file only with a valid signature or a same-session seat token. A session code alone is not accepted. Responses use `X-Content-Type-Options: nosniff` and a sandbox content security policy. Local signatures use the built-in key in `lib/media/sign.ts` and expire. The default lifetime is 15 minutes.
- The submit button says the record is saving. The upload is one request. There is no byte-level progress event, and the UI does not invent one.
- On Vercel, local disk is refused. `storageStatus` returns not configured unless `STORAGE_PROVIDER=supabase`. That is the current public health result. No Supabase project is connected.

### 4. Competing meaning hypotheses

**Implemented. Demo output is simulated.**

- `lib/ai/demo-provider.ts` returns several readings from the written description, evidence type, and action label. It sets `simulated: true` and does not read file bytes.
- `lib/ai/openai-provider.ts` can call an OpenAI-compatible chat endpoint when `getAIMode()` is `openai`. It sets `simulated: false`. Media is sent only after consent, and the audio path does not invent a transcription when no audio model is configured.
- Accept, reject, and challenge are in `lib/domain/discovery.ts`. A non-editor receives HTTP 403: `Only the facilitator can change a hypothesis.` Acceptance writes a participant interpretation. It does not set session-verified.
- The hypothesis board can filter the statuses that are actually stored. The buttons show a saving state. They do not mark the meaning verified.
- `displayStatus` in `lib/constants.ts` shows Guess, Facilitator-supported observation, Disputed, and Session-verified without adding a database status.

### 5. Experiment creation and completion

**Implemented locally, including a rule planner. A live model plan is untested.**

- Manual checks are created from `app/api/sessions/[code]/experiments/route.ts` and `lib/domain/checks.ts`.
- The active planner is `requestExperimentPlan` in `lib/ai/plan.ts`. In demo mode it saves a rule plan with `simulated: true` and source `rules`. The engine label is `Simulated experiment recommendation — no model analyzed this session.` (`components/experiments/engine.tsx`, `SIMULATED_PLAN_NOTE`).
- If AI mode is openai, a failed, refused, timed-out, or invalid model response throws. The code does not substitute a demo plan. That behavior is unit-tested with a mock `fetch`. It has not been run against a live model.
- A facilitator can approve, edit, or reject a proposal. Approval can create a check. Recording an outcome sets `verified` false in the review record (`lib/experiments/outcomes.ts`). One experiment cannot session-verify a concept.
- Community discrimination uses rules while AI mode is demo (`source: "rules"`, `simulated: false`) in `lib/community/propose.ts`. A live failure throws and does not save the rule draft. The rules path is a heuristic, not a measured information gain.

### 6. Blinded responses, locking, and reveal

**Implemented for proposal replies and community independent responses.**

- `presentReplies` hides another person’s body and stance until two distinct participants have `lockedAt`. The owner can see their own reply. The hidden sentence in the UI stays `Locked. Hidden until both responses are in.`
- `comparisonOpen` in `lib/community/visibility.ts` is true only when two distinct authors have locked. `presentResponse` clears body and media until then.
- Community timeline text for `hypothesis.*`, `experiment.answered`, and `task.outcome` is replaced for non-facilitators by `redactPrivateEvent`.
- Ordinary verification responses in a community session stay filtered to the viewer until two authors have answered. After that, the result is visible. Notes stay with the author unless the viewer can see the research plan.
- This reveal logic was not re-exercised with two browsers in this audit. The unit tests in `tests/experiment-engine.test.ts` and `tests/community.test.ts` cover the pure functions.

### 7. Verification logic, documentation, and UI

**The rule is implemented and consistent in code and the current UI. One README sentence is stale.**

Session-verified requires all of the following, in `lib/verification/status.ts`:

- a participant has accepted the wording
- no disagreement
- at least two correct decisive responses
- those responses use at least two distinct stimulus keys and at least two methods
- at least three quarters of the recorded responses in the round match
- the matching decisive responses come from at least two `authorId` values

The same stimulus counts once. One person meeting the numeric thresholds gets status `awaiting` and the reason beginning `Facilitator-supported observation`. The stored status is not a new value. The UI label comes from `displayStatus`. The verified reason says the result is inside this session only and is not a claim of linguistic truth.

Practice is built only from status `verified` (`PRACTICEABLE` in `lib/learning/build.ts`). The shared board and expression picker offer session-verified meanings for a new row. Uncertain concepts stay visible and are not selectable for that row.

`README.md` still says practice is generated from tentative or verified entries. That sentence is wrong. The workspace copy and the API error match the code.

AI confidence is stored and displayed as not a measured probability. Quality checks are a count out of 8, not a probability, and they do not change verification.

### 8. AI provider integration

**Demo path: implemented and simulated. Live path: implemented behind configuration, untested against a model.**

`getAIMode` in `lib/ai/config.ts` returns `openai` only when `AI_PROVIDER=openai` and `OPENAI_API_KEY` is non-empty. Otherwise it returns `demo`. Local `.env` is demo with an empty key. The public health report is also demo.

What demo mode does:

- hypotheses from description, type, and action label
- experiment plans from recorded readings and rules
- community checks from `selectDiscriminatingExperiment`
- no file inspection, no transcription, no IPA, no automatic verification

What a configured live call would do, from code that has only been tested with mocks:

- send consented written descriptions, not every file
- refuse the call when the facilitator has not confirmed sharing
- validate the JSON with Zod
- retry one rate-limit response
- fail closed instead of saving a simulated plan

No live model request was made in this audit.

### 9. Database, migrations, and Supabase

**Local SQLite: implemented. Postgres schema: present and rehearsed in-process. Real Postgres and Supabase: not connected.**

- Runtime schema is `prisma/schema.prisma`, provider SQLite. `DATABASE_URL` for local development is `file:../data/first-contact.db`.
- `prisma/schema.postgresql.prisma` mirrors the models, including `AccessCredential`.
- `prisma/migrations/20261124220325_init/migration.sql` is a create-only migration and includes `AccessCredential`. It has not been applied to a hosted Postgres database.
- `tests/postgres-rehearsal.test.ts` copies the sample session into embedded PGlite and checks that a second copy is refused. That is not a Supabase project and not a network Postgres server.
- `scripts/copy-sqlite-to-postgres.mjs` and `scripts/migrate-postgres.mjs` exist. They were not run against a real server in this audit.
- `lib/storage/supabase.ts` is the production store. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are empty in `.env.example` and are not set on the public deployment, according to the health report.
- Protected local backups under `data/backups/` were not opened or modified.

### 10. Authentication, authorization, privacy, recovery, rate limiting

**Seat checks and export limits are implemented. There is no account system and no rate limit.**

- Roles are visitor, participant, host, and facilitator (`lib/access/policy.ts`). Host is seat A in a non-community session. Facilitator is the community seat A. There is no research-administrator role and no cross-session export.
- Export is `canExportSession`: facilitator or host, and only that session. Community research export strips private fields unless the viewer is the facilitator (`lib/domain/research.ts`).
- Participants cannot export. Hypothesis mutation is facilitator or host only, on the server, not only in the button visibility.
- Demo reset and demo enter require `ALLOW_DEMO_OPERATOR=1`, a secret of at least 24 characters, and a non-hosted environment (`lib/demo/operator.ts`). The local gate is off. Both routes return 403. Cross-origin requests are refused before a secret match.
- Recovery is the seat key described above. There is no email, password, or OAuth account.
- A search of the TypeScript sources found no rate limiter. Create, join, evidence upload, and analysis can be called as fast as the server accepts them.
- The recovery key is shown to its owner inside the session sidebar so they can rejoin. It is not a second person’s key. It is still visible on a shared screen.

### 11. Responsive behavior, accessibility, and error states

**Partial. The layout has deliberate breakpoints. This audit did not repeat the browser pass.**

- Public navigation collapses into a Menu below 960px (`components/layout/site.tsx`, `app/globals.css`). Session navigation becomes a horizontal scroller below 1040px. Controls use a 44px minimum height at that breakpoint.
- Discovery and evidence use tab buttons with `aria-selected`. Arrow keys move those tabs. Practice choices and board tiles use `aria-pressed`. The graph accepts plus, minus, and zero when focused.
- Theme can be switched with the button or with `T` outside a field. `prefers-reduced-motion: reduce` shortens animation and transition durations.
- Empty copy exists for an empty graph, an empty verified board, and practice that has no session-verified entry. API failures render the server message through `Notice`.
- `app/error.tsx` and `app/not-found.tsx` exist.
- Known gaps: the session rail is a scroll strip on a phone rather than a short menu; the sample recovery details element exposes the owner’s key to anyone looking at that screen; focus order is the DOM order, and a closed mobile menu is `display: none`. A full keyboard and screen-reader pass was not repeated in this audit. Earlier UI work did exercise light, dark, and a 390px width against the local production build. Those checks were not rerun today.

### 12. Deployment and environment

**Local development: configured. Preview and production: not configured. The public site is up and unusable for sessions.**

`scripts/check-env.mjs` accepts local SQLite with `STORAGE_PROVIDER=local` and no `DIRECT_URL`. For preview or production it requires a pooled Postgres URL with `pgbouncer=true` and `connection_limit=1`, a direct URL that is not the pooler, `STORAGE_PROVIDER=supabase`, an https `SUPABASE_URL`, a service-role key, a private bucket name, and a media signing secret of at least 16 characters. `env:check` was not given a production env file because those values are not present.

`npx next build` succeeded on 26 November 2026 before commit `4fb3e7e`. This audit did not rebuild.

The public `POST /api/sessions` probe used a normal create body and returned HTTP 503 `The database is not available.` No session was created.

## Critical bugs and security issues

### P0 — blocks safe or correct use by real users

1. **The public app cannot store a session.** Health is HTTP 503. Database provider is `unknown`. `POST /api/sessions` returns 503. Files would also be refused because storage is local on Vercel. Paths: `lib/health/report.ts`, `lib/storage/index.ts`, `app/api/sessions/route.ts`.
2. **A shared server can be scanned for join codes.** There is no rate limit. The code space is 189,000 human-readable values. A hit confirms the session, and a taken seat returns the occupant’s name. Paths: `lib/session/codes.ts`, `lib/domain/session.ts`. No limiter exists in `app/api` or `lib`.
3. **Seat keys are the only access control.** Anyone who has a key is that seat. Legacy sample keys in `lib/demo/illustrative.ts` do not expire. New keys are hashed, but a copied recovery key works until it expires, is replaced, or the person leaves. There is no second factor and no server-side session list protection beyond possession of the key.

These three are configuration and missing controls. Fixing them means a hosted Postgres database, a private bucket, a signing secret, and a limiter on create, join, rejoin, and uploads. That is infrastructure, not a local one-line change. It was not started.

### P1 — needed for a convincing working demo in front of judges

1. Say, in the demo script, that AI mode is demo and that no model inspected the files. The product already says this on the landing page and on simulated plans. A judge who only reads the stale practice sentence in the README can still get the wrong idea.
2. Do not present the public Vercel URL as the working app until health is HTTP 200 and a session can be created.
3. Research and general sessions show the experiment plan to both seats. Use a community session when the demonstration depends on blinded replies.
4. The sample seat tokens are in the public source file `lib/demo/illustrative.ts`. On a machine that has loaded that seed, those keys enter `SHORE-1001`. They do not enter sessions created later.
5. Two-browser blinded reveal, camera upload, and microphone upload were not rerun in this audit.

### P2 — important quality

1. `README.md` says practice includes tentative entries. `lib/learning/build.ts` does not.
2. `README.md` still describes media authorization as `GET /api/media/[id]?code=`. The route uses a signature or a seat token.
3. The impact summary type fixes `simulated: false` and the screen can read “Not a simulation.” The accompanying note is honest for the sample session, but the short label is easy to misread (`lib/community/impact.ts`, `components/community/impact.tsx`).
4. A hypothesis that is neither `participant` nor `simulated` is labeled `AI hypothesis` (`components/discovery/workspace.tsx`). Demo provider rows are simulated, so this is a labeling hole rather than the current demo path.
5. The mobile session rail scrolls sideways instead of using the public Menu pattern.
6. There is no automated browser test in the test script. `npm test` is unit tests only.

### P3 — optional polish

1. Upload progress cannot be shown honestly until the request exposes progress.
2. More keyboard shortcuts beyond theme, tabs, and graph zoom.
3. The recovery-key disclosure could be hidden until the owner asks, which it already is inside a `details` element. A shorter confirmation would reduce accidental exposure.

## Missing backend or infrastructure

- Hosted Postgres using `prisma/migrations/20261124220325_init/migration.sql`, then `DIRECT_URL` for migrate and the pooled `DATABASE_URL` for the app.
- A private Supabase bucket and `STORAGE_PROVIDER=supabase`. The service-role key must stay server-only.
- `MEDIA_SIGNING_SECRET` of at least 16 characters on any shared deployment.
- A rate limit on `POST /api/sessions`, `POST /api/sessions/join`, `POST /api/sessions/rejoin`, evidence upload, and analyze.
- An OpenAI-compatible key only if a judge must see a live plan. Demo mode should remain available and labeled. A failed live plan must stay failed.
- The Vercel project needs those variables. They are not set today. Do not put the service-role key or the model key in `NEXT_PUBLIC_*`.

## Tests actually run for this audit

Command: `npx vitest run --reporter=verbose` in `first-contact-language-builder`.

Result: **10 files, 78 tests, all passed.** Duration about 3.3 seconds. Started 20:26 local time on 26 November 2026.

| File | What it actually covers | Result |
| --- | --- | --- |
| `tests/core.test.ts` | Codes, verification thresholds, demo hypotheses, practice limited to session-verified entries, path traversal, claim labels | Passed |
| `tests/access-control.test.ts` | Visitor, host, facilitator, one-author versus two-author verification, outcome mapping | Passed |
| `tests/security-hardening.test.ts` | Demo operator gate, hashed expiring recovery keys, legacy key until renewal | Passed |
| `tests/audit-privacy.test.ts` | Community event redaction, no single-check verification, live discrimination does not fall back to rules | Passed |
| `tests/experiment-engine.test.ts` | Rule plans, hidden drafts, timeline, live failure does not save a demo plan | Passed |
| `tests/ai-planning.test.ts` | Consent, untrusted text, mock retries, quality checklist is not a probability, 12-scenario structural benchmark | Passed |
| `tests/community.test.ts` | Hidden drafts, reveal after two locks, experiment selection does not crown a winner | Passed |
| `tests/reliability.test.ts` | Health status, log redaction, SQLite-to-Postgres value conversion, local upload round trip | Passed |
| `tests/production-migration.test.ts` | Media signatures, Vercel polling, copy table list | Passed |
| `tests/postgres-rehearsal.test.ts` | Embedded PGlite copy of the sample session, create-only migration, production disk refusal | Passed |

Also observed, not as unit tests:

- Local `GET /api/health` HTTP 200, demo, SQLite.
- Public `GET /api/health` HTTP 503, database disconnected.
- Public `POST /api/sessions` HTTP 503, `The database is not available.`
- SQLite query: only `SHORE-1001`, 8 concepts, 8 evidence.

Not run in this audit: `scripts/smoke.mjs`, `scripts/reliability-journey.mjs`, `scripts/community-journey.mjs`, `scripts/experiment-journey.mjs`, `scripts/security-hardening.mjs`, `scripts/access-audit.mjs`, a second browser, a live model, a real Postgres server, and a Supabase upload.

## Simulated or not tested

Simulated, and labeled in code:

- Demo hypotheses and demo experiment plans.
- Rule-based community discrimination while `AI_PROVIDER` is demo.
- `SHORE-1001` itself. It is an illustrative seed, not fieldwork. Its stored statuses are seed data. They are not recomputed unless a concept is mutated. This audit did not mutate it.
- The structural benchmark. It checks plan shape. It is not a user study.

Not tested against a real external system:

- OpenAI or any other live model.
- Hosted Postgres.
- Supabase storage.
- The public deployment beyond the failing health and create probes.
- Camera, microphone, and file-upload permissions in a browser during this audit.
- A two-person blinded reveal on the current build during this audit.

## Prioritized roadmap

1. **P0.** Put Postgres, a private bucket, and a media signing secret on the Vercel project. Apply the existing migration with the direct URL. Confirm `GET /api/health` is 200 and that a throwaway session can be created and deleted. Do not point local development away from SQLite.
2. **P0.** Add a small rate limit in front of create, join, rejoin, and upload before anyone other than the operator can reach the server. Keep the opaque 404. Avoid returning the occupant’s name until the code is already known through a successful join.
3. **P0.** Treat a copied seat key as full access to that seat. For a public demo, do not load the legacy sample tokens, or replace them on first run without printing the new values. Leave the local `SHORE-1001` rows in place.
4. **P1.** Demonstrate on a community session so seat B does not see the plan. Keep the landing disclosure that demo mode did not inspect files.
5. **P1.** Correct the two stale README sentences so a judge does not think tentative entries become practice items or that a session code authorizes media.
6. **P1.** If a live model is required, set `AI_PROVIDER=openai` and a server-side key, run one consented plan, and keep the failure path. Do not describe that run as done until the request actually happens.
7. **P2.** Rerun the HTTP journey scripts against the local server and record their status codes. Add one browser test for join, evidence, blinded lock, and reveal.
8. **P3.** Tighten the mobile session navigation and the impact-summary wording.

## Files that decide the verdict

- `lib/verification/status.ts`, `lib/constants.ts`, `lib/learning/build.ts`
- `lib/domain/session.ts`, `lib/domain/common.ts`, `lib/domain/discovery.ts`, `lib/domain/checks.ts`, `lib/domain/serialize.ts`
- `lib/access/policy.ts`, `lib/access/credentials.ts`, `lib/session/codes.ts`
- `lib/experiments/privacy.ts`, `lib/community/visibility.ts`, `lib/community/propose.ts`
- `lib/ai/config.ts`, `lib/ai/plan.ts`, `lib/ai/demo-provider.ts`, `lib/ai/openai-provider.ts`
- `lib/health/report.ts`, `lib/storage/index.ts`, `lib/media/sign.ts`, `scripts/check-env.mjs`
- `prisma/schema.prisma`, `prisma/schema.postgresql.prisma`, `prisma/migrations/20261124220325_init/migration.sql`
- `app/api/sessions/route.ts`, `app/api/media/[id]/route.ts`, `app/api/health/route.ts`
- `lib/demo/illustrative.ts`, `lib/demo/operator.ts`
