# Reliability audit

Date: 24 November 2026. The local database was copied to `data/backups/first-contact-before-reliability-20261124-210043.db` before repairs. `SHORE-1001` was not reset. It still has 8 concepts. Nothing was deployed or pushed.

## Local environment

- App: Next.js 15.5.29, React 19, Prisma 6.19.0, SQLite file `data/first-contact.db`.
- Port 3000 is an unrelated Python process. It was left running. The app was served at `http://127.0.0.1:3010`.
- `.env` is present. `DATABASE_URL`, `AI_PROVIDER`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, and the upload limits are set. `OPENAI_API_KEY` is empty, so the app stays in demo mode. `OPENAI_AUDIO_MODEL` is not set.
- No Supabase URL, service-role key, or Postgres URL is configured.

## Reproduced failures

Production, checked against https://first-contact-language-builder.vercel.app/ on 24 November 2026:

- `GET /api/health` returned HTTP 200 and `{"ok":true,"mode":"demo",...}`. It did not look at a database.
- `POST /api/sessions` returned HTTP 500 and `{"error":"Unexpected server error."}`.
- That matches a Prisma client with no `DATABASE_URL`. SQLite and `data/uploads` do not survive on Vercel serverless. The Vercel environment list was empty when this was last inspected. This audit did not change the live deployment, so that production failure is still there.

Local, before the health repair:

- Unit tests: 23 passed.
- TypeScript and ESLint: passed.
- Production build: passed.
- HTTP smoke test on port 3010: passed.
- The isolated two-participant journey passed every product step. The only local failure was `/api/health`: it returned `ok: true` with no database field.

The journey that passed, on a session created for the audit and then deleted:

1. Landing page loaded.
2. Participant A created a session and received a code and recovery key.
3. Participant B joined with the code.
4. Both reads showed Ada and Bao.
5. Image, drawing, wav audio, and a gesture description were saved.
6. The image was readable with the session code and not with `TREE-0000`.
7. Demo analysis returned 4 hypotheses, `source: "ai"`, `simulated: true`, status `open`.
8. No concept was verified by that analysis.
9. Accepting a hypothesis left it `tentative`.
10. A contrast check answered by B stayed `awaiting`.
11. A repeated check with a different note, answered by A, became `verified`.
12. Contradictory evidence reopened the concept.
13. A direct vocabulary entry, a practice answer, an expression trial, and a graph edge were saved.
14. The Markdown export contained the session and the methodology, and not the recovery key.
15. A second read from both seats still showed 5 evidence items.
16. Rejoin with A's recovery key worked. The wrong confirmation code did not delete the session.
17. Deleting the audit session left `SHORE-1001` at 8 concepts.

A browser on the same local server created "Browser audit" as Ada, stored the recovery key, reloaded the session, and deleted only that session. The code was `FIELD-8441`. Two seats in one browser profile still share one localStorage key per session code. The second person needs their own browser. That is existing behavior, not a new defect.

## Root causes

- Health treated process startup as application health and never queried SQLite.
- API handlers turned Prisma connection failures into a generic HTTP 500, and the raw error can contain a connection string.
- The Prisma schema is SQLite. Uploads use `process.cwd()/data/uploads`. Neither exists as durable storage on Vercel, and no production database URL is configured.

## Repairs

- `/api/health` now reports application readiness, database connectivity, storage configuration, and AI mode separately. `ok: true` requires a connected database and persistent storage. Otherwise the route returns HTTP 503. Demo mode is reported as the local engine. An OpenAI configuration is probed with a short `/models` request and the key is not returned.
- Prisma initialization failures and unreachable-database codes return HTTP 503 with "The database is not available." Logged messages have connection strings and bearer tokens redacted.
- Uploads go through `lib/storage`. `STORAGE_PROVIDER=local` keeps files in `data/uploads`. `STORAGE_PROVIDER=supabase` uses the Supabase Storage REST API with the server-only service-role key. A Postgres `DATABASE_URL` paired with local disk is reported as not persistent.
- `prisma/schema.postgresql.prisma` matches the SQLite models and adds a pooled `DATABASE_URL` plus `DIRECT_URL`. `npm run build` generates the SQLite client when the URL is a file, and the Postgres client when it is Postgres.
- `npm run db:copy` only prints table counts unless Postgres is configured and `CONFIRM_DATA_COPY=yes`. It does not modify SQLite. It was not run against a database. `pg` is not installed.

## Test results after the repairs

- Unit tests: 29 passed (`tests/core.test.ts` 23, `tests/reliability.test.ts` 6).
- TypeScript: passed.
- ESLint: passed, 0 warnings.
- Production build: passed. Prisma generated from `prisma/schema.prisma`.
- Smoke test on `http://127.0.0.1:3010`: passed.
- Journey script on that server: passed, including the new health check (`database.connected: true`, `provider: sqlite`).
- Browser create, reload, and delete: passed. The audit session was removed. `SHORE-1001` remains the only session.
- The copy script exited 2 and printed counts only. SQLite was unchanged.
- Live OpenAI and live Supabase were not called. There are no credentials.

## Production architecture

The deployed app cannot be made durable by pointing SQLite at `/tmp`. It needs:

1. A Supabase project.
2. `DATABASE_URL`: pooled Postgres URL with `pgbouncer=true`.
3. `DIRECT_URL`: direct Postgres URL for Prisma.
4. `STORAGE_PROVIDER=supabase`.
5. `SUPABASE_URL`.
6. `SUPABASE_SERVICE_ROLE_KEY` on the server only. Do not use a `NEXT_PUBLIC_` name.
7. `SUPABASE_STORAGE_BUCKET`: a private bucket. The default name in `.env.example` is `session-media`.
8. `npx prisma db push --schema prisma/schema.postgresql.prisma` against that empty database.
9. Optional copy with `CONFIRM_DATA_COPY=yes` after `npm install pg`, only if Postgres has no sessions yet. Do not run `db:seed` afterward if the copied `SHORE-1001` rows should stay as they are. Seed replaces that illustrative session.
10. A new Vercel deployment after those variables exist. This audit did not deploy, so https://first-contact-language-builder.vercel.app/ is still the broken build.

## Outstanding blockers

- No Supabase project, Postgres URL, or service-role key is available. Production is not ready and was not tested against a real Postgres database.
- The data copy script has not been executed, so date and boolean conversion into Postgres is untested.
- Vercel still has no environment variables. Session creation there will keep failing until the variables exist and the repaired build is deployed.
- One browser profile holds one recovery key per session code.
