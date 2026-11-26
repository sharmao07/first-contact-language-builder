# Phase 1 — Hosted Infrastructure Report

**Status:** Discovery, private bucket verification, and 6 of 9 Vercel Production environment variables (including a newly generated `MEDIA_SIGNING_SECRET`) are **complete**. **Live PostgreSQL migrations, the remaining 3 Supabase secret environment variables, Phase 1 Vercel deployment, and live end-to-end production verification are blocked** pending `DATABASE_URL`, `DIRECT_URL`, and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase Dashboard.

---

## 1. Status Matrix (Parts 1–7)

| Task | Status | Notes |
| --- | --- | --- |
| **Part 1 — Supabase Discovery** | **Completed & Verified** | Inspected org, project, Postgres version, tables, migrations, storage bucket, and RLS policies via `supabase_mcp`. |
| **Part 2 — PostgreSQL Migrations** | **Blocked (Missing Credentials)** | Schema parity & migrations verified cleanly on local SQLite + embedded PGlite; live Supabase DB migration requires `DATABASE_URL` and `DIRECT_URL` (DB password is not exposed by `supabase_mcp`). |
| **Part 3 — Private Supabase Storage** | **Bucket Verified / E2E Blocked** | `session-media` exists with `public: false`, `rls_enabled: true`, `0` objects, and `0` permissive public/anon policies; live upload/download verification requires `SUPABASE_SERVICE_ROLE_KEY`. |
| **Part 4 — Secrets & Env Prep** | **Partially Completed** | Generated `MEDIA_SIGNING_SECRET` (`openssl rand -hex 32`) directly into Vercel Production without logging; `STORAGE_PROVIDER`, `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET`, `RATE_LIMIT_STORE`, and `AI_PROVIDER` set on Vercel Production. Remaining 3 secrets require Supabase Dashboard copy. |
| **Part 5 — Vercel Configuration** | **Partially Completed** | Authenticated Vercel CLI (`ojussharma07-4877`, team `sharm-07`, project `first-contact-language-builder`); 6 env vars configured in Production. Deployment held because DB migration & 3 secrets are pending. |
| **Part 6 — Real Production Verification** | **Baseline Checked / Blocked** | Current pre-Phase-1 deploy checked (`GET /api/health` → **HTTP 503**). Remaining 12 live checks await DB migration, secrets, and Phase 1 deployment. |

---

## 2. Part 1 — Supabase Discovery Results

- **Organization**: `sharmao07's Org` (`lzpvmfofigehzavohwbs`, plan `free`)
- **Project**: `first-contact-production` (`mogsdvdgfwpsssvcjjoc`)
  - **Region**: `ap-southeast-2`
  - **Status**: `ACTIVE_HEALTHY`
  - **Database Engine**: PostgreSQL `17.12.0.002` (`db.mogsdvdgfwpsssvcjjoc.supabase.co`)
  - **Project API URL**: `https://mogsdvdgfwpsssvcjjoc.supabase.co`
- **Database State**:
  - `public` schema: **empty (`0` tables)**
  - Applied Supabase migrations: **none (`0` migrations)**
  - Security advisors (`get_advisors` type `security`): **clean (`lints: []`)**
- **Storage State**:
  - Bucket `session-media`: **exists**, **`public: false`** (private)
  - `storage.objects`: `0` rows, `rls_enabled: true`, `0` policies in `pg_policies` for `storage` or `public` (blocks direct `anon` / `authenticated` access; matches server-only `SUPABASE_SERVICE_ROLE_KEY` calls in `lib/storage/supabase.ts`).
- **Missing Permissions / Credentials (MCP Constraint)**:
  - `supabase_mcp` intentionally omits the database password (`DATABASE_URL` / `DIRECT_URL`) and the `service_role` key (`SUPABASE_SERVICE_ROLE_KEY`). Only `get_publishable_keys` (anon/publishable keys) is exposed by MCP.

---

## 3. Part 2 & 3 — Database, Migrations & Storage Verification

- **Schema & Migration Readiness** (verified locally, not yet applied to `mogsdvdgfwpsssvcjjoc`):
  - `prisma/migrations/20261124220325_init/migration.sql` (20 tables including `DiscoverySession`, `AccessCredential`, `Participant`, `Evidence`, `Concept`, etc., plus all foreign keys and indexes)
  - `prisma/migrations/20261126213500_add_rate_limit_buckets/migration.sql` (`RateLimitBucket` table + `RateLimitBucket_expiresAt_idx`)
  - Both are create-only, non-destructive, and match `prisma/schema.postgresql.prisma`.
  - **Reason not applied via `supabase_mcp` `apply_migration`**: `scripts/migrate-postgres.mjs` (`npm run db:migrate`) invokes `prisma migrate deploy`, which requires `_prisma_migrations` metadata created cleanly using `DIRECT_URL` + `DATABASE_URL` rather than `supabase_migrations.schema_migrations` alone.
- **Storage Implementation Match** (`lib/storage/supabase.ts`):
  - Confirmed exact variable name: `SUPABASE_STORAGE_BUCKET` (defaults to `"session-media"`).
  - Uploads (`POST /storage/v1/object/<bucket>/<path>`), server-proxied reads (`GET /storage/v1/object/authenticated/<bucket>/<path>`), and session-scoped deletes (`DELETE`) authenticate exclusively with `SUPABASE_SERVICE_ROLE_KEY` on the server.
  - Because `storage.objects` has `rls_enabled = true` and zero policies for `anon`/`authenticated`, no client-side direct bucket access is permitted, and no broad public policies exist.
- **Local SQLite & `SHORE-1001` Protection**:
  - Untouched (`npm run env:check` passed; `data/first-contact.db` still active for local development).

---

## 4. Part 4 & 5 — Vercel Project & Environment State

- **Vercel Project**: `sharm-07/first-contact-language-builder`
- **Production URL**: `https://first-contact-language-builder.vercel.app`
- **Currently Active Deployment**: `dpl_AJktJ3sVFGdcsfVEbLgKv3d8PzWj` (`first-contact-language-builder-l7hukds3r-sharm-07.vercel.app`, built from pre-Phase-1 commit `57c2e7d` at `2026-11-26 21:20:38 GMT+0530`). Phase 1 local changes are uncommitted and intentionally **not deployed yet** until database migrations succeed.
- **Pre-existing Vercel Env Vars**: `0` (`No Environment Variables found`).
- **Configured Now in Vercel `Production` (Hidden Secrets, Values Not Printed)**:
  - `STORAGE_PROVIDER` (`supabase`)
  - `SUPABASE_URL` (`https://mogsdvdgfwpsssvcjjoc.supabase.co`)
  - `SUPABASE_STORAGE_BUCKET` (`session-media`)
  - `RATE_LIMIT_STORE` (`auto`)
  - `AI_PROVIDER` (`demo`)
  - `MEDIA_SIGNING_SECRET` (generated locally with `openssl rand -hex 32` directly via stdin)
- **Still Missing in Vercel `Production`**:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

---

## 5. Part 6 — Actual HTTP & Test Results Observed

### Live Production Baseline Check (Before Env Complete / Before Phase 1 Deploy)
- `GET https://first-contact-language-builder.vercel.app/api/health` → **HTTP 503**
  ```json
  {"ok":false,"mode":"demo","application":{"ready":false},"environment":"production","database":{"connected":false,"provider":"unknown"},"storage":{"provider":"local","configured":false,"available":false,"persistent":false,"detail":"A production deployment cannot keep uploads on local disk. Set STORAGE_PROVIDER=supabase."},"media":{"configured":false,"detail":"Set MEDIA_SIGNING_SECRET to at least 16 characters."},"sync":{"transport":"poll"},"ai":{"mode":"demo","configured":true,"available":true,"detail":"Demo mode uses the local hypothesis engine. It does not call an external model."}}
  ```

### Local Verification (Previously Run on Phase 1 Code; No Code Edited Since)
- `npm run env:check` (after Vercel link & env setup): **passed** (`development environment and migrations are valid.`).
- Phase 1 test suite & local server checks (already recorded in `PHASE-1-PRODUCTION-READINESS-REPORT.md`): `npx vitest run` (11 files, 90 tests passed), `typecheck`, `lint` (0 errors), `build`, and all 8 journey/browser scripts passed locally on SQLite.

### Hosted Checks Still Pending Credentials & Deploy
- PostgreSQL migration against `mogsdvdgfwpsssvcjjoc`
- Live `/api/health` HTTP 200 verification
- Live PostgreSQL + private Supabase Storage + signed media proxy + PostgreSQL `RateLimitBucket` HTTP 429 + session create/2nd-browser join/upload/cross-session auth denial + legacy sample token rejection against `https://first-contact-language-builder.vercel.app`

---

## 6. Remaining Security Risks

1. **Pre-Phase-1 Deployment Currently Live Without Hosted Env**: `first-contact-language-builder.vercel.app` currently serves commit `57c2e7d` returning `503` on `/api/health` until migrations, the 3 missing secrets, and the Phase 1 deploy complete.
2. **Post-Migration Supabase `public` Schema Exposure Check Needed**: Once `npm run db:migrate` creates the 20 Prisma tables in `public`, Supabase Data API (`PostgREST`) exposes `public` schema tables unless RLS is enabled on them (with no `anon`/`authenticated` policies) or `public` is removed from Data API exposed schemas. Run `get_advisors` (`security`) via `supabase_mcp` immediately after migration and enable RLS on all `public` tables if flagged (Prisma connects as the DB role and continues working normally).
3. **Vercel Preview Scope**: Only `Production` env vars are configured so far; if Preview deployments are enabled, configure a separate Preview Supabase project rather than sharing Production credentials.

---

## 7. Exact Next Actions Required From You

1. **Retrieve 3 Credentials from Supabase Dashboard (`mogsdvdgfwpsssvcjjoc`)**:
   - **Project Settings → Database → Connection string**:
     - `DATABASE_URL`: **Transaction pooler** (`:6543/...?pgbouncer=true&connection_limit=1`)
     - `DIRECT_URL`: **Direct connection** (`:5432/...`, without `pgbouncer=true`)
   - **Project Settings → API**:
     - `SUPABASE_SERVICE_ROLE_KEY`: `service_role` secret key

2. **Add the 3 Remaining Env Vars to Vercel Production** (or provide them securely when ready so I can run steps 2–5):
   ```bash
   vercel env add DATABASE_URL production
   vercel env add DIRECT_URL production
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   ```

3. **Apply Non-Destructive Prisma Migrations to `mogsdvdgfwpsssvcjjoc`** (never run `db:seed`):
   ```bash
   DATABASE_URL="<POOLED_POSTGRES_URL>" \
   DIRECT_URL="<DIRECT_POSTGRES_URL>" \
   npm run db:migrate
   ```

4. **Confirm Database Lockdown & Deploy Phase 1**:
   - Ask me to run `supabase_mcp` `list_tables` / `get_advisors` after step 3 to verify all tables, indexes, `_prisma_migrations`, and `public` RLS lockdown.
   - Commit & push Phase 1 changes (`git add` / `commit` / `push`, or `vercel --prod`), then I will execute all 12 live production checks in Part 6 against `https://first-contact-language-builder.vercel.app`.
