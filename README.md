# First-Contact Language Builder

Building understanding where language ends.

First-Contact Language Builder is a local web application for two people who do not share a language. They collect images, drawings, sounds, gestures, and notes, then test possible meanings together. The software can suggest readings. It does not declare one of them correct.

An AI suggestion stays a hypothesis until a participant accepts it. Acceptance is tentative. A meaning is marked verified only after at least two decisive checks, no recorded disagreement, and at least three quarters of the responses matching the intended reading. One success is not proof. Verified entries can be reopened.

## Core features

- Guest seats. A person creates a session, shares a code such as `TREE-4821`, and the other person joins as participant A or B. A recovery key lets someone rejoin the same seat.
- Shared session state. Both browsers poll the same session and see new evidence, hypotheses, and checks.
- Evidence. Camera capture, image upload, a drawing canvas, microphone recording, gesture descriptions, and short video uploads. Files stay in `data/uploads` and are served only with the matching session code.
- Hypotheses. A demo facilitator, or an optional OpenAI-compatible model, proposes several readings, ambiguities, and a follow-up check. Participants can accept, reject, or challenge. Nothing is auto-verified.
- Verification. Visual discrimination, context testing, reverse demonstration, contrast testing, and repeated checks. The status rule is shown in the workspace.
- Vocabulary. Search, filter, edit, archive, dispute, and reopen entries. Each card keeps its evidence and status reason.
- Expression trials. Combine existing concepts. Order and grammar notes are labeled as hypotheses.
- Practice. Activities are generated only from tentative or verified entries in that session. A miss stores a clarification.
- Research. Counts, a timeline, contributions, concept history, and JSON, CSV, and Markdown export.
- Relationship graph. Real session concepts and edges, with an empty state and an accessible list of the same links.
- Illustrative session `SHORE-1001`, marked as sample data rather than fieldwork.
- Light and dark themes. Privacy notice and session deletion.

## Technology stack

- Next.js App Router, React, TypeScript
- Tailwind CSS
- A small shadcn-style button (`class-variance-authority`, `clsx`, `tailwind-merge`)
- Lucide icons and Framer Motion
- Prisma ORM and SQLite
- Zod
- `d3-force` for the relationship layout

## Architecture

Browser pages call route handlers under `app/api`. Those handlers validate input with Zod and call domain functions in `lib/domain`. Domain functions are the only writers of session data, and every query is scoped by session id.

`lib/ai` defines a provider interface. `getProvider()` returns the demo provider unless `AI_PROVIDER=openai` and `OPENAI_API_KEY` are both set. Keys are read only on the server. The demo provider uses the written description and evidence type. It does not inspect file bytes, and every result says so.

Uploaded files are written under `data/uploads/<sessionId>` with a generated name. `GET /api/media/[id]?code=` checks that the evidence belongs to that session before reading the file. SVG uploads from participants are rejected. Media responses are sent with a sandbox content security policy.

Session presence is a poll of `/api/sessions/[code]/sync` about every 2.5 seconds. A matching revision returns presence only. A new revision returns the full session.

## Folder structure

```
app/                  pages and route handlers
components/           workspace, vocabulary, practice, graph, research
lib/ai                provider interface, demo provider, OpenAI-compatible provider
lib/domain            session, evidence, checks, serialization, research
lib/verification      status rule and experiment prompts
lib/learning          practice generation
lib/research          Markdown and CSV formatters
lib/storage           private upload paths
prisma/schema.prisma  relational model
prisma/seed.ts        illustrative session
data/                 SQLite database and uploads
tests/                unit tests
scripts/smoke.mjs     HTTP smoke test against a running server
```

## Installation

From a fresh checkout, in this folder:

```bash
npm install
npm run db:setup
```

`db:setup` generates the Prisma client, creates `data/first-contact.db`, and seeds the illustrative session.

Copy `.env.example` to `.env` if you do not already have one. The SQLite path is resolved relative to the `prisma/` directory.

## Local development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build and run:

```bash
npm run build
npm run start
```

## Database

The schema includes sessions, participants, evidence, concepts, vocabulary entries, hypotheses, relationships, verification experiments and responses, learning activities and responses, research notes, expression trials, and session events. Foreign keys cascade on session deletion. Concepts carry a status, a human-readable status reason, and a reopen timestamp so older disagreements stay in the history without permanently blocking a new round of checks.

```bash
npm run db:push     # apply schema.prisma to the local SQLite file
npm run db:seed     # replace the illustrative session only
```

## Demo mode

Demo mode is the default. It is active whenever `AI_PROVIDER` is not `openai` or `OPENAI_API_KEY` is empty.

The landing page secondary action, Explore a demo, opens an illustrated session:

- Code: `SHORE-1001`
- Name: First Contact Experiment 001
- Seats: Researcher A and Participant B

Enter either seat from `/demo`. Two browsers can enter the two seats. Reset illustrative data replaces that sample and leaves sessions you created.

The sample shows water being split from drinking and from a container, a rejected river reading, a disputed movement gesture, verified and unresolved entries, checks, practice, an expression trial, and research notes. It is labeled illustrative. It is not real linguistic research, and its hypotheses were not produced by inspecting the files.

You can also create an empty session and submit your own evidence. In demo mode the facilitator still responds, using only what you typed and the evidence type. The workspace says that the file itself was not analyzed.

## AI provider configuration

In `.env`:

```bash
AI_PROVIDER="demo"
OPENAI_API_KEY=""
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4o-mini"
AI_TIMEOUT_MS="25000"
OPENAI_AUDIO_MODEL=""
```

To use an OpenAI-compatible chat completions endpoint:

```bash
AI_PROVIDER="openai"
OPENAI_API_KEY="your key"
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4o-mini"
OPENAI_AUDIO_MODEL=""
```

The key is never sent to the browser. A file is sent only when the participant checks consent on that piece of evidence. With consent, a JPEG, PNG, GIF, or WebP under 4 MB can be described by the vision model. Observations stay separate from inferred meanings. Audio is sent only when `OPENAI_AUDIO_MODEL` is set, the file is wav or mp3, and consent is checked. The prompt forbids translation and invented phonemes. Browser recordings are often webm, so they stay on disk unless you upload wav or mp3. Whole videos are not sent. A participant can capture one frame and submit that still. If the provider errors, rate-limits, times out, or returns an unexpected shape, the app reports the failure and does not substitute a simulated analysis or verify anything.

If `AI_PROVIDER=openai` but the key is missing, the app stays in demo mode and says why.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite URL, relative to `prisma/`. Default `file:../data/first-contact.db`. |
| `AI_PROVIDER` | `demo` or `openai`. |
| `OPENAI_API_KEY` | Server-only key. Empty enables demo mode. |
| `OPENAI_BASE_URL` | OpenAI-compatible base URL. |
| `OPENAI_MODEL` | Chat model name. |
| `OPENAI_AUDIO_MODEL` | Optional audio-capable model. Empty means recordings are stored and not sent. |
| `AI_TIMEOUT_MS` | Provider timeout. Default 25000. |
| `MAX_IMAGE_BYTES` | Image and drawing limit. Default 8000000. |
| `MAX_AUDIO_BYTES` | Audio limit. Default 10000000. |
| `MAX_VIDEO_BYTES` | Video limit. Default 25000000. |

## Testing

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Phase 2 left 23 unit tests covering verification independence, malformed model output, missing consent, and demo mode. See `PHASE-2-REPORT.md`.

With the app running:

```bash
npm run smoke
```

The smoke script creates a session, joins a second seat, uploads an image, checks that hypotheses are not auto-verified, runs two checks, builds practice and an expression, exports Markdown, checks that another session code cannot read the file, and deletes the smoke session.

## Production data

Local development stays on SQLite (`DATABASE_URL=file:../data/first-contact.db`) and stores uploads in `data/uploads`. Vercel cannot keep that disk or that file. The Vercel project currently has no database or storage variables, so production session creation still fails until those values exist. The setup sequence is in `SUPABASE-SETUP.md`. `npm run env:check` reports missing names and does not print values.

Use a separate Supabase project for Preview and for Production. Set the same variable names on each Vercel environment with different values. Do not point Preview at the Production database.

| Name | Development | Preview and Production |
| --- | --- | --- |
| `DATABASE_URL` | `file:../data/first-contact.db` | Supabase pooler, port 6543, `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | unset | Supabase direct connection, port 5432. Prisma uses this for migrations. |
| `STORAGE_PROVIDER` | `local` | `supabase` |
| `SUPABASE_URL` | empty | Project URL, server only |
| `SUPABASE_SERVICE_ROLE_KEY` | empty | Server only. Never use a `NEXT_PUBLIC` name. |
| `SUPABASE_STORAGE_BUCKET` | `session-media` | A private bucket. A public bucket fails the storage check. |
| `MEDIA_SIGNING_SECRET` | optional | At least 16 characters. Media links expire after 15 minutes unless `MEDIA_URL_TTL_SECONDS` is set. |

The service-role key is read only by server code. The browser receives a signed application URL, or sends the participant token, and this server reads the private object.

Apply the checked-in SQL migration to an empty database. This does not reset a database that already has rows, and it does not touch SQLite:

```bash
npm run db:migrate
```

`npm run db:copy` prints local row counts and stops. With `CONFIRM_DATA_COPY=yes` it copies into an empty Postgres database through `DIRECT_URL`, then uploads `data/uploads` when storage is Supabase. It refuses to write if Postgres already has sessions. It does not delete the SQLite file or the local uploads. `npm run db:seed` replaces the illustrative `SHORE-1001` session, so do not seed after a copy.

`/api/health` checks the database, storage, and media signing separately. It returns 503 unless all three are usable, and it does not include credentials.

On Vercel the session view polls `/api/sessions/[code]/sync`. The server-sent stream stays available for the local Node server and closes itself after 45 seconds. A Vercel function cannot hold that stream open for a whole session.

## Known limitations

- Locally, joined seats receive server-sent updates about once a second, with polling if the stream drops. On Vercel, seats poll about every 2.5 seconds. A quiet seat still shows as quiet after about 12 seconds without a heartbeat.
- Only two seats exist, A and B. A seat left behind stays reserved for its recovery key.
- The recovery key lives in the browser's local storage. Losing it means that seat cannot be reclaimed.
- The session code is the access secret for this local installation. Anyone who can open the server and knows the code can read that session.
- Demo hypotheses do not look at pixels or audio. They are labeled as simulations. A failed live provider call is not replaced with a simulation.
- Audio is not translated. Acoustic description happens only with consent, a wav or mp3 file, and `OPENAI_AUDIO_MODEL`.
- A whole video is not analyzed. One selected frame can be submitted as an image.
- Session-verified means the session's own rule was met. It is not a claim of linguistic truth.
- The graph can be panned, zoomed, and dragged. It is not a full diagram editor.
- Practice can only be as rich as the evidence already in the session. Gesture and expression activities ask the participant to judge themselves. The app does not watch them.
- This application does not create a legal community-ownership right. It only keeps data on the machine that runs it.
- There is no account system, no multi-user server auth, and no encryption at rest.

## Future development

- A community-run sync service with authenticated seats and encrypted media.
- More providers behind the same interface, still unable to auto-verify.
- Phonetic comparison that does not pretend to know an undocumented language.
- Offline use and export packages a community can carry without this codebase.
- Stronger separation between a researcher's machine and a public demo.

## Scientific stance

An image does not have one obvious meaning. Pointing does not settle a word. A gesture can mean different things in different communities. Similar sounds are not similar meanings. Agreement is stored with its context. Checks should use varied examples. Model confidence is labeled as an estimate, not a probability. The record can hold ambiguity and disagreement. Participants can reject the software.
