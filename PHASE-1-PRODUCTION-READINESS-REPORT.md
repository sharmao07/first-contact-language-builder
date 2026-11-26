# Phase 1 — Production Readiness Report

**Status:** Code, tests, local SQLite & PGlite verification, and setup checklists are complete. **Hosted Vercel, Supabase PostgreSQL, Supabase Storage, and optional Upstash Redis have not been provisioned or tested yet** because manual dashboard credentials and Vercel team access authorization are required.

---

## 1. Changes Made

### Infrastructure, Migration & Deployment Configuration
- Added `RateLimitBucket` (`key`, `windowStartMs`, `count`, `expiresAt`) identically to `prisma/schema.prisma` (SQLite) and `prisma/schema.postgresql.prisma` (PostgreSQL).
- Created non-destructive additive migration `prisma/migrations/20261126213500_add_rate_limit_buckets/migration.sql` (`CREATE TABLE` / `CREATE INDEX` only) alongside existing `prisma/migrations/20261124220325_init/migration.sql`.
- Pushed `RateLimitBucket` to the local SQLite database (`data/first-contact.db`) without modifying `SHORE-1001` (verified `SHORE-1001` intact: `8` concepts, `8` evidence, `11` hypotheses, `2` participants).
- Updated `lib/storage/index.ts` and `lib/media/sign.ts` to share `isHostedDeployment()` (`VERCEL === "1" || VERCEL_ENV === "production" || VERCEL_ENV === "preview" || databaseKind() === "postgresql"`), preventing silent local-disk storage fallback or built-in dev signing secret usage on any hosted/PostgreSQL deployment.
- Updated `lib/health/report.ts` (`buildHealthReport`) to probe PostgreSQL/SQLite migration readiness (`DiscoverySession` + `RateLimitBucket`) and `rateLimitStatus()`, returning HTTP `503` whenever database, private storage, media signing, or rate limiting is unconfigured or unavailable.
- Added `vercel.json` with `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, and `Permissions-Policy: camera=(), microphone=(self), geolocation=()`.
- Created `PRODUCTION-SETUP-CHECKLIST.md` and updated `.env.example`.

### Distributed Rate Limiting (No In-Memory Fallback)
- Created `lib/security/rate-limit.ts`:
  - Supports **Upstash Redis / Vercel KV REST** (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL` + `KV_REST_API_TOKEN` using atomic Lua `INCR`/`PEXPIRE`) and **atomic database buckets** (`RateLimitBucket` via PostgreSQL `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count` and SQLite transactional `upsert`, selectable via `RATE_LIMIT_STORE=auto|database|redis`).
  - Separate configurable policies per action (`RATE_LIMIT_*_MAX`, `RATE_LIMIT_*_WINDOW_SEC`):
    - `session_create` (default `20` / `900s`)
    - `session_join` (default `30` / `900s`)
    - `session_rejoin` (default `20` / `900s`)
    - `evidence_upload` (default `60` / `900s`)
    - `ai_plan` (default `40` / `900s`)
  - Multi-dimensional bucket keys combining hashed client IP (`x-vercel-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, `x-forwarded-for`), normalized session code (`code` normalized uppercase), presented participant token hash, and action-global ceilings (`session_join` / `session_rejoin` against IP rotation; per-session code bucket to resist guessing).
  - Returns HTTP `429 Too Many Requests` with `Retry-After` and `X-RateLimit-*` headers without leaking session existence or seat validity.
  - Fails closed with HTTP `503` when the configured distributed store is unavailable or misconfigured.
- Updated `lib/http.ts` and `lib/api/handlers.ts` so `HttpError` and `json()` propagate custom headers cleanly and map missing tables (`P2021`) to `503`.
- Applied `enforceRateLimit` in:
  - `app/api/sessions/route.ts` (`session_create`)
  - `app/api/sessions/join/route.ts` (`session_join`)
  - `app/api/sessions/rejoin/route.ts` (`session_rejoin`)
  - `app/api/sessions/[code]/evidence/route.ts` (`evidence_upload`)
  - `app/api/sessions/[code]/analyze/route.ts` (`ai_plan`)
  - `app/api/sessions/[code]/plans/route.ts` (`ai_plan` on `action === "request"`)
  - `app/api/sessions/[code]/community/route.ts` (`ai_plan` on `action === "propose"`)

### Legacy Sample Credential Isolation & Error Obfuscation
- Updated `lib/access/credentials.ts` (`resolvePresented`): when `isHostedDeployment()` is `true`, rejects `PUBLIC_SAMPLE_TOKENS` (`demo-shore-1001-participant-a`, `demo-shore-1001-participant-b`) and unprefixed/legacy plaintext tokens; local SQLite development keeps `SHORE-1001` functional.
- Updated `lib/demo/illustrative.ts` and `prisma/seed.ts` to refuse seeding `SHORE-1001` or writing reusable public sample credentials into hosted/PostgreSQL environments (`ensureIllustrativeSession`).
- Updated `lib/domain/session.ts` (`joinSession`): archived sessions return opaque `404 OPAQUE_SESSION` (matching unknown codes), and occupied-seat `409` responses no longer expose existing occupant `displayName`.

### Environment & Deployment Readiness Checks
- Updated `scripts/check-env.mjs` (`assessEnvironment`, `verifyMigrationsReady`):
  - Enforces PostgreSQL `DATABASE_URL` and direct `DIRECT_URL` (with `pgbouncer=true` check when pooled), `STORAGE_PROVIDER=supabase`, `SUPABASE_URL` (`https://`), server-only `SUPABASE_SERVICE_ROLE_KEY`, valid private `SUPABASE_STORAGE_BUCKET`, `MEDIA_SIGNING_SECRET` (`>= 16` chars), valid `RATE_LIMIT_STORE` (`auto`, `database`, or `redis` with HTTPS REST credentials), and `OPENAI_API_KEY` when `AI_PROVIDER=openai`.
  - Verifies no secrets appear in `NEXT_PUBLIC_*` environment variables and validates both Prisma migrations exist without destructive SQL.

---

## 2. Files Changed & Created

### Modified (20 files)
- `.env.example`
- `app/api/sessions/route.ts`
- `app/api/sessions/join/route.ts`
- `app/api/sessions/rejoin/route.ts`
- `app/api/sessions/[code]/analyze/route.ts`
- `app/api/sessions/[code]/community/route.ts`
- `app/api/sessions/[code]/evidence/route.ts`
- `app/api/sessions/[code]/plans/route.ts`
- `lib/access/credentials.ts`
- `lib/api/handlers.ts`
- `lib/demo/illustrative.ts`
- `lib/domain/session.ts`
- `lib/health/report.ts`
- `lib/http.ts`
- `lib/media/sign.ts`
- `lib/storage/index.ts`
- `prisma/schema.prisma`
- `prisma/schema.postgresql.prisma`
- `prisma/seed.ts`
- `scripts/check-env.mjs`

### Created (5 new Phase 1 files)
- `lib/security/rate-limit.ts`
- `prisma/migrations/20261126213500_add_rate_limit_buckets/migration.sql`
- `tests/phase1-production.test.ts`
- `vercel.json`
- `PRODUCTION-SETUP-CHECKLIST.md`
- `PHASE-1-PRODUCTION-READINESS-REPORT.md` (this report)

*(Unchanged local baseline already present before Phase 1: `POST-UI-READINESS-AUDIT.md`.)*

---

## 3. Infrastructure Still Requiring Manual Setup

1. **Vercel Team Access / CLI Authorization**: Inspecting the Vercel project returned `403` on team `sharm-07` (`team_ohihQvfRPsl7oUTIGbBpLhX4`). Team access must be granted/authorized in Vercel.
2. **Supabase Production Project & PostgreSQL**: Provision hosted PostgreSQL in Supabase, capture pooled `DATABASE_URL` (`:6543/...?pgbouncer=true&connection_limit=1`) and direct `DIRECT_URL` (`:5432/...`), and apply the two non-destructive migrations (`npm run db:migrate`).
3. **Private Supabase Storage Bucket**: Create private bucket (e.g., `session-media`, Public **OFF**) and copy `SUPABASE_URL` + server-only `SUPABASE_SERVICE_ROLE_KEY`.
4. **Media Signing Secret**: Generate and set `MEDIA_SIGNING_SECRET` (`openssl rand -hex 32`).
5. **Vercel Environment Variables & Redeploy**: Configure Production (and separate Preview if enabled) environment variables in Vercel and redeploy.
6. **Optional Upstash Redis / Vercel KV**: If choosing `RATE_LIMIT_STORE=redis` over the default PostgreSQL `RateLimitBucket` store, provision Upstash Redis and add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

---

## 4. Required Environment Variables (Hosted Production)

| Variable | Required | Value / Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled PostgreSQL URL (`:6543/...?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Yes | Direct PostgreSQL URL (`:5432/...`, without `pgbouncer=true`) |
| `STORAGE_PROVIDER` | Yes | `supabase` |
| `SUPABASE_URL` | Yes | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only Supabase service role key (never `NEXT_PUBLIC_*`) |
| `SUPABASE_STORAGE_BUCKET` | Yes | Private bucket name (e.g., `session-media`) |
| `MEDIA_SIGNING_SECRET` | Yes | Random server-only secret (`>= 16` chars; 32+ recommended) |
| `RATE_LIMIT_STORE` | Yes | `auto` (default DB-backed), `database`, or `redis` |
| `AI_PROVIDER` | Yes | `demo` or `openai` |
| `OPENAI_API_KEY` | If `AI_PROVIDER=openai` | Server-only OpenAI key |
| `UPSTASH_REDIS_REST_URL` | If `RATE_LIMIT_STORE=redis` | `https://...` REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | If `RATE_LIMIT_STORE=redis` | Server-only Redis REST token |
| `RATE_LIMIT_*_MAX` / `_WINDOW_SEC` | Optional | Per-action overrides (`SESSION_CREATE`, `SESSION_JOIN`, `SESSION_REJOIN`, `EVIDENCE_UPLOAD`, `AI`) |
| `ALLOW_DEMO_OPERATOR` | Unset in prod | Do not enable in public production |

---

## 5. Tests & Checks Actually Run

All automated checks below were executed after the final code edit against **local SQLite (`data/first-contact.db`), embedded PGlite (schema/migration rehearsal), and mocked/local test doubles**:

- `npx vitest run`: **11 test files, 90 tests passed** (includes `tests/phase1-production.test.ts` with 12 new tests, `tests/production-migration.test.ts` PGlite migration test, `tests/reliability.test.ts` SQLite/PostgreSQL schema parity check, `tests/security-hardening.test.ts`, `tests/access-control.test.ts`, `tests/core.test.ts`, `tests/community-discovery.test.ts`, `tests/experiment-plans.test.ts`, `tests/analysis.test.ts`, `tests/evidence-modalities.test.ts`, `tests/postgres-rehearsal.test.ts`).
- `npm run typecheck` (`tsc --noEmit`): **passed (0 errors)**.
- `npm run lint` (`eslint .`): **passed (0 errors; 1 pre-existing warning in untouched `scripts/security-hardening.mjs:98` `no-unused-vars`)**.
- `npm run env:check`: **passed** for local SQLite development.
- `npm run build` (`node scripts/prepare-prisma.mjs && next build`): **passed**.
- Production local server verification (`npx next start -p 3016` on SQLite):
  - `GET /api/health`: **HTTP 200** (`ok: true`, `database.migrated: true`, `rateLimit.provider: "database"`, `rateLimit.available: true`).
  - `npm run smoke`: **passed**.
  - `node scripts/reliability-journey.mjs`: **passed**.
  - `node scripts/community-journey.mjs`: **passed**.
  - `node scripts/experiment-journey.mjs`: **passed**.
  - `node scripts/security-hardening.mjs`: **passed**.
  - `node scripts/access-audit.mjs`: **passed**.
  - `node scripts/community-browser.mjs`: **passed** (Playwright).
  - `node scripts/experiment-browser.mjs`: **passed** (Playwright).
- Post-test database verification: cleared transient `RateLimitBucket` rows and confirmed `SHORE-1001` integrity (`concepts: 8`, `evidence: 8`, `hypotheses: 11`, `participants: 2`).

**Explicit non-claim:** Live hosted **Supabase PostgreSQL**, **Supabase private Storage**, **Upstash Redis**, and the live **Vercel deployment** were **not** tested in Phase 1 because cloud credentials/dashboard configuration are pending manual setup.

---

## 6. Remaining Security Concerns (Deferred / Operational)

1. **Unconfigured Hosted Deployment Until Manual Setup**: Once PostgreSQL/Supabase/Redis env vars are added in Vercel, `PRODUCTION-SETUP-CHECKLIST.md` verification commands must be executed against the live deployment before treating production as operational.
2. **Bearer Seat Tokens & Shared Join Codes**: Seat tokens remain bearer credentials in browser storage/headers until explicit leave, rejoin token rotation, or deletion; human-readable `FIELD-XXXX` codes have limited entropy (`189k` space) and rely on `session_join` / `session_rejoin` distributed rate limits + opaque `404` responses to deter brute-force enumeration.
3. **Database-Backed Rate Limit Pruning**: Under `RATE_LIMIT_STORE=database` / `auto`, expired `RateLimitBucket` rows expire logically (`expiresAt <= now`) and reset cleanly on reuse, though periodic row cleanup (`DELETE FROM "RateLimitBucket" WHERE "expiresAt" < now()`) or switching to Redis TTL (`RATE_LIMIT_STORE=redis`) is advisable under sustained traffic.
4. **No Automated Malicious Upload AV Scanning / Rate Limiting on Media Proxy**: Media uploads validate type/size limits, and `/api/media/[key]` verifies HMAC signatures + session seat access; server-side malware scanning and CDN/edge throttling are not included.

---

## 7. Exact Commands for Deployment Verification

After completing `PRODUCTION-SETUP-CHECKLIST.md`:

```bash
# 1. Validate production environment variables and migration readiness locally
DATABASE_URL="<POOLED_POSTGRES_URL>" \
DIRECT_URL="<DIRECT_POSTGRES_URL>" \
STORAGE_PROVIDER="supabase" \
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>" \
SUPABASE_STORAGE_BUCKET="session-media" \
MEDIA_SIGNING_SECRET="<SIGNING_SECRET>" \
RATE_LIMIT_STORE="auto" \
AI_PROVIDER="demo" \
node scripts/check-env.mjs production

# 2. Apply non-destructive PostgreSQL migrations (do NOT run db:seed)
DATABASE_URL="<POOLED_POSTGRES_URL>" \
DIRECT_URL="<DIRECT_POSTGRES_URL>" \
npm run db:migrate

# 3. Verify live health endpoint returns HTTP 200 with ok=true
curl -sS -i https://first-contact-language-builder.vercel.app/api/health

# 4. Verify legacy sample token is rejected on production (expect HTTP 401/404)
curl -sS -i -H "x-participant-token: demo-shore-1001-participant-a" \
  https://first-contact-language-builder.vercel.app/api/sessions

# 5. Run smoke test against hosted production (cleans up its own test session)
SMOKE_BASE=https://first-contact-language-builder.vercel.app npm run smoke
```
