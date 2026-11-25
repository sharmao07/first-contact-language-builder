# Production migration report

Date: 24 November 2026.

This working copy is not production-ready. The two-participant journey has not been run against PostgreSQL or Supabase Storage, because those credentials do not exist locally or on the Vercel project. Nothing was deployed, pushed, or committed.

## What changed

Local development still uses SQLite and `data/uploads`. Preview and Production are prepared for Supabase Postgres and a private Storage bucket.

- `prisma/schema.postgresql.prisma` keeps the same models as the SQLite schema and adds `directUrl = env("DIRECT_URL")`. Prisma 6.19 uses that direct URL for migrations and the pooled `DATABASE_URL` for the running app.
- `prisma/migrations/20261124220325_init/migration.sql` is a create-only migration generated from that schema. `npm run db:migrate` applies it with `prisma migrate deploy`. It refuses to run unless `DATABASE_URL` is the pooler URL (`pgbouncer=true`) and `DIRECT_URL` is a direct Postgres URL. It does not call `migrate reset` and it does not open the SQLite file.
- `npm run db:copy` reads SQLite in read-only mode. It copies only when `CONFIRM_DATA_COPY=yes`, only through `DIRECT_URL`, and only when Postgres has zero sessions. It then uploads `data/uploads` if `STORAGE_PROVIDER=supabase`. It does not delete local rows or files. The copy list includes `CommunicationTask`, `IndependentResponse`, and `ExperimentProposal`.
- Media bytes stay behind the server. The browser gets a signed URL that expires after six hours, or it can send the participant token. A session code in the query string is no longer enough. The service-role key is not sent to the client. A public Supabase bucket fails the storage check.
- On Vercel, session sync polls `/api/sessions/[code]/sync`. The server-sent stream remains for the local Node process and closes itself after 45 seconds. Vercel Functions, including Hobby, have a default duration of 300 seconds, so a stream cannot stay open for a whole session. Holding one open would also occupy the single pooled database connection.

## Source data

The local database was copied to `data/backups/first-contact-before-postgres-migration-20261124-220325.db` before this work. After the checks, SQLite still contains one session: `SHORE-1001`, purpose `general`, 8 concepts. The copy script's read-only count was DiscoverySession 1, Participant 2, Concept 8, Evidence 8, ConceptHypothesis 11, VerificationExperiment 12. No rows were written to Postgres.

`npm run db:migrate` exited 1 because `DATABASE_URL` is still `file:../data/first-contact.db` and `DIRECT_URL` is unset. `npm run db:copy` exited 2 and printed the same refusal. SQLite was not modified by either command.

## Configuration

Set these on the Vercel project separately for Preview and Production. Use a different Supabase project for each so a preview deployment cannot write the production record. Development on this machine stays on SQLite.

| Name | Development | Preview and Production |
| --- | --- | --- |
| `DATABASE_URL` | `file:../data/first-contact.db` | Supabase transaction pooler, port 6543, `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | unset | Supabase direct host, port 5432 |
| `STORAGE_PROVIDER` | `local` | `supabase` |
| `SUPABASE_URL` | empty | `https://<project>.supabase.co`, server only |
| `SUPABASE_SERVICE_ROLE_KEY` | empty | server only, never `NEXT_PUBLIC` |
| `SUPABASE_STORAGE_BUCKET` | `session-media` | private bucket of that name |
| `MEDIA_SIGNING_SECRET` | optional | at least 16 characters, different per environment |

`vercel env ls` for `sharm-07/first-contact-language-builder` returned no environment variables. `.env` contains only the SQLite `DATABASE_URL`. There is no Supabase CLI login in this environment.

When credentials exist, the order is:

1. Create the private bucket `session-media`.
2. Put the variables on the chosen Vercel environment.
3. Run `npm run db:migrate` with those URLs in the shell. Do not run `prisma migrate reset`.
4. Run `CONFIRM_DATA_COPY=yes npm run db:copy`. Do not run `npm run db:seed` afterwards.
5. Run the two-participant journey against that database before calling the deployment ready.

## Server-sent events

`app/api/sessions/[code]/stream/route.ts` polls the database every 1.2 seconds and writes an event stream. That invocation lives until the client disconnects or the platform stops it. Vercel Fluid Compute ends the invocation at the function duration, 300 seconds by default on every plan. The local client already fell back to polling when a stream died, then tried to open the stream again. On Vercel that would keep a function and a pooled connection busy. The server now tells the Vercel client to poll, about every 2.5 seconds, through the existing sync route. This was decided from the platform limit. It was not observed on the deployed project, because this change was not deployed.

## Tests that ran

Against the local SQLite app at `http://127.0.0.1:3010` after a production build:

- `npx vitest run`: 40 tests passed.
- `npx tsc --noEmit`: passed.
- `npx eslint . --max-warnings 0`: passed.
- `npm run build`: passed.
- `scripts/smoke.mjs`: passed.
- `scripts/reliability-journey.mjs`: passed. Signed image retrieval returned the PNG bytes. A request with `?code=TREE-0000` returned 404. The participant token could still read the file. Session verification, research export, and deletion of only the test session passed. SHORE-1001 stayed at 8 concepts.
- `scripts/community-journey.mjs`: passed, including a hidden response, a blocked participant approval, and the shared board.

Local `/api/health` returned `ok: true`, `environment: development`, database provider `sqlite`, persistent local storage, and the development media key. `sync.transport` was `stream` because this process is not Vercel. That is a local result, not a Supabase result.

## Tests that did not run

The two-participant journey was not run against PostgreSQL. No private bucket was created, no migration was applied, and no rows or files were copied. The live site at `https://first-contact-language-builder.vercel.app/` was not updated.

## Remaining blockers

- No Supabase project, pooled URL, direct URL, service-role key, or media signing secret is available.
- The Vercel project has no environment variables, so setting `DATABASE_URL` has not happened and would not, by itself, create tables or a private bucket.
- Until `npm run db:migrate`, `CONFIRM_DATA_COPY=yes npm run db:copy`, and the two-participant journey succeed against those services, production is not ready.
