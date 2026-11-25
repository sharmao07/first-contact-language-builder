# Phase 4B report

Date checked: 24 November 2026. Local app: http://127.0.0.1:3010. Nothing was committed, pushed, or deployed. Vercel environment variables were not changed. No Supabase project was created.

This is not production-ready. The categories below are separate.

## 1. Implemented

- PostgreSQL schema and create-only migration: `prisma/schema.postgresql.prisma`, `prisma/migrations/20261124220325_init/migration.sql`.
- Copy script refuses a missing source, a missing backup, a destination that already has rows, and a column the source cannot fill. It converts booleans and timestamps, preserves tokens, checks row counts and foreign keys, then commits. `COPY_FILES_ONLY=yes` uploads files without inserting again.
- Local disk stays the development store. On Vercel, or when `DATABASE_URL` is Postgres, the server refuses local disk instead of writing there.
- Private media links last 15 minutes by default. `MEDIA_URL_TTL_SECONDS` can set 60 seconds through 60 minutes. Polling refreshes the links without waiting for a new session revision.
- Evidence storage is updated in the same failure path as the file write. A failed write or a failed row update removes the object and the new row. Deletion marks the row first, then removes the object, and can be retried if the object is still attached.
- `/api/health` reports application, database, storage, media signing, sync transport, and AI separately. `ok` requires a connected database, configured and reachable persistent storage, and media signing. AI failure does not by itself make `ok` false. The response has no credentials.
- Vercel still polls. If the stream route returns JSON `{transport:"poll"}`, the browser stays on polling. Local Node still opens the short SSE stream.
- `npm run env:check` and `scripts/check-env.mjs` name missing or incompatible variables and do not print values.
- Setup steps are in `SUPABASE-SETUP.md`. Local `.env` remains SQLite.

## 2. Tested locally

- 46 unit tests passed, including the new rehearsal and guard tests.
- `tsc --noEmit` passed. ESLint passed with zero warnings. `npm run build` passed. The build generates the SQLite Prisma client because local `DATABASE_URL` is a file URL.
- `npm run env:check` passed for development. The same command with `production` exited 1 and listed the missing production names. It did not print a value.
- Smoke, reliability journey, community journey, and the two-browser Community Access journey passed against http://127.0.0.1:3010.
- After those journeys, SQLite had one session, `SHORE-1001`, purpose `general`, 8 concepts.
- `/api/health` returned HTTP 200, `ok: true`, `environment: development`, `database.provider: sqlite`, `database.connected: true`, local storage available, sync transport `stream`, AI mode `demo`.
- The source file `data/first-contact.db` and the backup `data/backups/first-contact-before-postgres-migration-20261124-220325.db` were still present after the rehearsal. The rehearsal opened the source read-only and checked that its size and modification time did not change.

## 3. Tested against real PostgreSQL

Not tested against a PostgreSQL server.

Docker, `psql`, `postgres`, and Docker.app are not installed. No database URL exists.

An embedded PostgreSQL engine, PGlite 0.6.0, applied the checked-in migration SQL in memory and ran the copy function against the real SQLite file in read-only mode. That rehearsal:

- created the schema from `migration.sql`;
- copied every table;
- confirmed `SHORE-1001` and 8 concepts;
- confirmed evidence rows still point at that session;
- confirmed participant tokens were present, unique, and not blank;
- confirmed the second copy threw `CopyRefused` and did not insert again;
- confirmed the SQLite file and the backup were unchanged.

PGlite is not Supabase and it is not a deployed Postgres server. Do not treat this rehearsal as production verification.

## 4. Tested against real Supabase Storage

Not tested. There is no project URL, no private bucket, and no service-role key. The copy script did not upload anything. The storage client was tested only for its refusal to use local disk when `VERCEL=1`.

## 5. Deployed and production verified

Not deployed. The live Vercel deployment was not modified. It still has no database or storage variables. A passing local health check does not describe that deployment.

## Files audited

- `PRODUCTION-MIGRATION-REPORT.md`
- `prisma/schema.prisma`, `prisma/schema.postgresql.prisma`
- `prisma/migrations/20261124220325_init/migration.sql`, `migration_lock.toml`
- `scripts/copy-sqlite-to-postgres.mjs`, `scripts/migrate-postgres.mjs`, `scripts/prepare-prisma.mjs`, `scripts/check-env.mjs`
- `lib/storage/index.ts`, `lib/storage/local.ts`, `lib/storage/supabase.ts`, `lib/storage/files.ts`
- `lib/media/sign.ts`, `lib/domain/discovery.ts`, `lib/domain/serialize.ts`
- `lib/health/report.ts`, `lib/sync/transport.ts`
- `app/api/health/route.ts`, `app/api/media/[id]/route.ts`, `app/api/sessions/[code]/stream/route.ts`, `app/api/sessions/[code]/sync/route.ts`
- `components/session/provider.tsx`
- `.env.example`, `README.md`
- `tests/production-migration.test.ts`, `tests/reliability.test.ts`, `tests/postgres-rehearsal.test.ts`

## Problems found and fixed

- Health asked the storage object for its status before noticing that production was still on local disk. That call now throws, so the status check returns the misconfiguration first.
- A Postgres or Vercel process could previously construct the local disk store when `STORAGE_PROVIDER` was unset. It now fails closed.
- The copy checked only `DiscoverySession` before writing. It now requires every copied table to be empty, and it checks counts and foreign keys before commit.
- The copy did not require the named backup to be a SQLite file. It now does.
- SQLite integers can arrive as bigint. Boolean and timestamp conversion now handles that.
- Signed media links lasted six hours. They now last 15 minutes unless configured, and an unchanged poll still refreshes them.
- A file could be stored and then left without a database path if the following update failed. The row and object are now removed together.
- Deletion removed the object before marking the row. The row is marked first, so a failed removal can be retried.
- A Vercel stream response is JSON. The browser treated that as a live stream and reconnected. It now stays on polling.
- `application.ready` was always true. It now follows `ok`.
- The smoke script defaulted to port 3000, which is a different process. It now defaults to 3010.

## Migration safety

The migration SQL is create-only. It has no `DROP TABLE`, `TRUNCATE`, or `DELETE FROM`. The migrate command still refuses unless both URLs are Postgres, `DIRECT_URL` is not the pooler, and `DATABASE_URL` includes `pgbouncer=true`. It does not open SQLite and it does not reset a database.

The copy preserves primary keys by inserting the source ids. Postgres foreign keys and the extra orphan checks run before commit. A failure rolls back. A second copy stops because the destination is no longer empty. Local SQLite is opened read-only. `db:seed` is not part of the copy.

## Outstanding credentials

These values do not exist yet. Do not invent them.

- Preview Supabase project and Production Supabase project.
- Pooled `DATABASE_URL` for each, port 6543, with `pgbouncer=true&connection_limit=1`.
- Direct `DIRECT_URL` for each, port 5432, without the pooler flag.
- `SUPABASE_URL` for each.
- `SUPABASE_SERVICE_ROLE_KEY` for each, server only.
- Private bucket `session-media` in each project.
- `MEDIA_SIGNING_SECRET` for each, at least 16 characters, different values.
- `STORAGE_PROVIDER=supabase` on Preview and Production.

`npm run env:check production` will stay red until those are present.

## Activation steps

Follow `SUPABASE-SETUP.md`. In short: create two Supabase projects, create a private `session-media` bucket in each, set the Vercel Preview and Production variables separately, run `npm run db:migrate`, then `CONFIRM_DATA_COPY=yes npm run db:copy`. After a deliberate deploy, `GET /api/health` must show `database.connected: true` and storage `available: true`. Open `SHORE-1001` and confirm 8 concepts, then run one new two-browser session and delete only that session.

Do not run `prisma migrate reset`. Do not run `npm run db:seed` after the copy.
