# First-Contact Language Builder

Two people who do not share a language can record what they show each other and test what it might mean. The app suggests readings. A person still has to accept one, and acceptance is only a tentative interpretation. Session-verified is a separate status, and it applies only inside that session.

A concept reaches session-verified after two people record matching checks on two different stimuli and two different methods, with no disagreement and at least three quarters of the responses matching. One person's matches stay a facilitator-supported observation. A verified entry can be reopened. The status is the session's own rule, not a claim that the meaning is linguistically true.

Live site: [first-contact-language-builder.vercel.app](https://first-contact-language-builder.vercel.app). The hosted app runs in demo mode. Hypotheses there are simulated from the written description, the evidence type, and the action label. No model inspects the image, drawing, or audio.

## What a session holds

One person creates a session and shares a code such as `TREE-4821`. The other person joins from a second browser as seat A or seat B. A recovery key, stored in that browser, reopens the same seat. Both browsers poll the session and see new evidence, hypotheses, and checks.

Evidence can be a camera photo, an uploaded image, a drawing, a microphone recording, a gesture description, a live demonstration, a short video, or a written note. Local files stay in `data/uploads`. Production files stay in a private storage bucket. A file is served only to a seat in that session.

The demo facilitator, or an optional OpenAI-compatible model, can propose several readings, name what is still ambiguous, and suggest one follow-up check. People can accept, reject, or challenge a reading. The app does not mark a concept verified on its own.

Checks include visual discrimination, context testing, reverse demonstration, contrast testing, and repeated trials. The vocabulary list can be searched, filtered, edited, archived, disputed, and reopened. Expression trials combine concepts that already exist, and any note about order or grammar is labeled as a hypothesis. Practice activities are built only from entries that session has verified. A miss stores a clarification. Research export is JSON, CSV, or Markdown for that session. The relationship graph uses the session's real concepts and links.

`SHORE-1001` is an illustrative sample. It is labeled as sample data, not fieldwork.

## Stack

Next.js App Router, React, TypeScript, and Tailwind CSS. Buttons use a small shadcn-style set (`class-variance-authority`, `clsx`, `tailwind-merge`). Icons are Lucide. Motion is Framer Motion. Data is Prisma with SQLite locally and PostgreSQL in production. Validation is Zod. The graph layout is `d3-force`.

## How the code is split

Pages call route handlers in `app/api`. Those handlers validate input with Zod and call `lib/domain`. Domain functions are the only writers of session data, and queries are scoped by session id.

`lib/ai` is the provider interface. `getProvider()` returns the demo provider unless `AI_PROVIDER=openai` and `OPENAI_API_KEY` are both set. The key stays on the server. The demo provider uses the written description and the evidence type. It does not read file bytes, and the result says so.

Uploads go to `data/uploads/<sessionId>` locally, or to a private Supabase bucket named by `SUPABASE_STORAGE_BUCKET` in production. `GET /api/media/[id]` accepts a server-signed URL (`?exp=...&sig=...`) or a matching `x-participant-token`. A bare `?code=` is rejected. Participant SVG uploads are rejected. Media responses use a sandbox content security policy.

Presence is a poll of `/api/sessions/[code]/sync` about every 2.5 seconds. The same revision returns presence only. A new revision returns the session.

```
app/                  pages and route handlers
components/           workspace, vocabulary, practice, graph, research
lib/ai                demo provider and OpenAI-compatible provider
lib/domain            session, evidence, checks, serialization
lib/verification      status rule and experiment prompts
lib/learning          practice generation
lib/storage           private upload paths
prisma/schema.prisma  relational model
prisma/seed.ts        illustrative session
data/                 local SQLite database and uploads
tests/                unit tests
scripts/smoke.mjs     HTTP smoke test against a running server
```

## Install and run

```bash
npm install
npm run db:setup
```

`db:setup` generates the Prisma client, creates `data/first-contact.db`, and seeds `SHORE-1001`. Copy `.env.example` to `.env` if you do not have one. The SQLite path is relative to `prisma/`.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build
npm run start
```

## Database

The schema covers sessions, participants, evidence, concepts, vocabulary, hypotheses, relationships, verification experiments and responses, learning activities, research notes, expression trials, and session events. Deleting a session cascades. A concept stores a status, a written reason, and a reopen time, so an old disagreement stays in the history.

```bash
npm run db:push     # apply schema.prisma to the local SQLite file
npm run db:seed     # replace the illustrative session only
```

## Demo mode

Demo mode is on unless `AI_PROVIDER` is `openai` and `OPENAI_API_KEY` is set. The sample session is `SHORE-1001`, named First Contact Experiment 001, with seats Researcher A and Participant B. Opening a seat or resetting that sample needs the local operator secret. `/demo` shows the two curl commands. Reset rewrites only that sample.

The sample splits water from drinking and from a container. It includes a rejected river reading, a disputed movement gesture, verified and unresolved entries, checks, practice, an expression trial, and research notes. You can also start an empty session. In demo mode the suggestions use what was typed and the evidence type. The workspace says the file itself was not analyzed.

## Live model

```bash
AI_PROVIDER="openai"
OPENAI_API_KEY="your key"
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4o-mini"
OPENAI_AUDIO_MODEL=""
AI_TIMEOUT_MS="25000"
```

Leave `AI_PROVIDER` as `demo` and `OPENAI_API_KEY` empty to stay in demo mode. If the provider is set to `openai` and the key is missing, the app stays in demo mode and says why.

The key is not sent to the browser. A file is sent only after the participant checks consent on that item. With consent, a JPEG, PNG, GIF, or WebP under 4 MB can go to the vision model. Observations stay separate from inferred meanings. Audio is sent only when `OPENAI_AUDIO_MODEL` is set, the file is wav or mp3, and consent is checked. The prompt forbids translation and invented phonemes. Browser recordings are often webm, so they stay stored unless someone uploads wav or mp3. A whole video is not sent. A participant can submit one frame as a still image. If the provider errors, rate-limits, times out, or returns an unexpected shape, the app reports the failure. It does not fill in a simulated analysis, and it does not verify a meaning.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite URL, relative to `prisma/`. Default `file:../data/first-contact.db`. |
| `AI_PROVIDER` | `demo` or `openai`. |
| `OPENAI_API_KEY` | Server-only. Empty keeps demo mode. |
| `OPENAI_BASE_URL` | OpenAI-compatible base URL. |
| `OPENAI_MODEL` | Chat model name. |
| `OPENAI_AUDIO_MODEL` | Optional. Empty means recordings are stored and not sent. |
| `AI_TIMEOUT_MS` | Provider timeout. Default 25000. |
| `MAX_IMAGE_BYTES` | Image and drawing limit. Default 8000000. |
| `MAX_AUDIO_BYTES` | Audio limit. Default 10000000. |
| `MAX_VIDEO_BYTES` | Video limit. Default 25000000. |

## Tests

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

With the app running:

```bash
npm run smoke
```

The smoke script creates a session, joins a second seat, uploads an image, checks that hypotheses stay unverified, runs two checks, builds practice and an expression, exports Markdown, checks that another session cannot read the file, and deletes that session.

## Production

Local development uses SQLite at `DATABASE_URL=file:../data/first-contact.db` and `data/uploads`. A hosted deployment needs PostgreSQL, a private storage bucket, server-side media signing, and rate limiting. `npm run env:check` reports missing or invalid config and does not print values.

Use a separate Supabase project for Preview and for Production. Set the same variable names on each Vercel environment with different values. Do not point Preview at the Production database.

| Name | Development | Preview and Production |
| --- | --- | --- |
| `DATABASE_URL` | `file:../data/first-contact.db` | Supabase pooler, port 6543, `?pgbouncer=true&connection_limit=5&pool_timeout=25` |
| `DIRECT_URL` | unset | Supabase direct connection (`:5432`, or the IPv4 session pooler `:5432` without `pgbouncer=true`). Prisma uses this for migrations. |
| `STORAGE_PROVIDER` | `local` | `supabase` |
| `SUPABASE_URL` | empty | Project URL, server only |
| `SUPABASE_SERVICE_ROLE_KEY` | empty | Server only. Do not put it in a `NEXT_PUBLIC` name. |
| `SUPABASE_STORAGE_BUCKET` | `session-media` | A private bucket. A public bucket fails the storage check. |
| `MEDIA_SIGNING_SECRET` | optional | At least 16 characters. Links expire after 15 minutes unless `MEDIA_URL_TTL_SECONDS` is set. |
| `RATE_LIMIT_STORE` | `auto` | `auto` uses the PostgreSQL `RateLimitBucket`. `database` and `redis` are the other choices. |

Server code reads the service-role key. The browser gets a signed application URL, or sends the participant token, and this server reads the private object.

Apply the checked-in SQL migration to an empty database. This does not reset a database that already has rows, and it does not touch SQLite:

```bash
npm run db:migrate
```

`npm run db:copy` prints local row counts and stops. With `CONFIRM_DATA_COPY=yes` it copies into an empty Postgres database through `DIRECT_URL`, then uploads `data/uploads` when storage is Supabase. It refuses to write if Postgres already has sessions. It does not delete the SQLite file or the local uploads. `npm run db:seed` replaces `SHORE-1001`, so do not seed after a copy.

`/api/health` checks the database, storage, and media signing separately. It returns 503 unless all three are usable, and the body does not include credentials.

On Vercel the session view polls `/api/sessions/[code]/sync`. The server-sent stream stays available on the local Node server and closes itself after 45 seconds. A Vercel function cannot hold that stream open for a whole session.

## Limits

Locally, joined seats get server-sent updates about once a second, and fall back to polling if the stream drops. On Vercel, seats poll about every 2.5 seconds. A quiet seat shows as quiet after about 12 seconds without a heartbeat.

There are two seats, A and B. A seat that leaves stays reserved for its recovery key. The key lives in that browser's local storage. If it is lost, the seat cannot be reclaimed. The key is hashed in `AccessCredential`. The session code alone does not open a taken seat, and hosted deployments reject the old sample tokens.

Demo hypotheses do not look at pixels or audio, and they are labeled as simulations. A failed live provider call is not replaced with a simulation. Audio is not translated. A whole video is not analyzed. The graph can be panned, zoomed, and dragged. Practice asks the participant to judge a gesture or expression. The app does not watch them. Saving data on the machine that runs the app does not create a legal ownership right. There is no account system and no encryption at rest.

## Later

A community-run sync service, more providers behind the same interface, phonetic comparison that does not pretend to know an undocumented language, and an export a group can carry without this codebase.

## What the record is for

An image can fit more than one meaning. Pointing does not settle a word. A gesture can mean different things in different communities. Similar sounds are not similar meanings. Agreement is stored with the situation it came from. Checks should use different examples. A model confidence number is an estimate, not a probability. The record can hold a disagreement, and the people in the session can reject what the software suggested.
