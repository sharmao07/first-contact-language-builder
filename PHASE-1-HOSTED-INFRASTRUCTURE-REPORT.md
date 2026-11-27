# Phase 1 — Hosted Infrastructure Report

**Status:** **Complete & Verified Live.** Supabase PostgreSQL (`mogsdvdgfwpsssvcjjoc`), private Supabase Storage (`session-media`), server-side HMAC media signing, all 9 Vercel Production environment variables, Prisma migrations, Phase 1 Vercel deployment (`478d527`), and all 13 live production verification checks passed against `https://first-contact-language-builder.vercel.app`.

> **Important Security Action Recommended Before Opening Public Access:** Supabase `list_tables` reports `rls_disabled` across all `21` tables in `public` (`_prisma_migrations` + the 20 Prisma tables). Although this application connects server-side as `postgres` (`rolbypassrls: true`) and never exposes `anon` keys in client bundles, leaving `public` schema tables with RLS disabled makes them reachable via Supabase's Data API (`PostgREST`) to anyone holding your project's public `anon` / publishable key. See **Section 5 (Remaining Security Risks & Recommended SQL)** for the exact remediation SQL.

---

## 1. Status Summary (Every Requirement)

| Check / Task | Outcome | Evidence |
| --- | --- | --- |
| **Supabase Discovery & Bucket** | **Passed** | Org `sharmao07's Org` (`lzpvmfofigehzavohwbs`, free), project `first-contact-production` (`mogsdvdgfwpsssvcjjoc`, `ap-southeast-2`, Postgres `17.12.0.002`, `ACTIVE_HEALTHY`), private bucket `session-media` (`public: false`, `rls_enabled: true`). |
| **Production Environment Variables** | **Passed** | All 9 required secrets/vars set in Vercel Production (`sharm-07/first-contact-language-builder`): `DATABASE_URL`, `DIRECT_URL`, `STORAGE_PROVIDER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `MEDIA_SIGNING_SECRET`, `RATE_LIMIT_STORE`, `AI_PROVIDER` (`demo`). |
| **PostgreSQL Migrations (`npm run db:migrate`)** | **Passed** | Applied `20261124220325_init` and `20261126213500_add_rate_limit_buckets` cleanly via Session Pooler (`:5432`); `prisma migrate status` reports `Database schema is up to date!`; 21 tables (incl. `DiscoverySession`, `AccessCredential`, `RateLimitBucket`, `_prisma_migrations`) and 63 indexes in `public`; never ran `db:seed`. |
| **Vercel Production Deploy** | **Passed** | Commit `478d527` (`478d5275214ea4f129a0efba2a2d3b3e5fda5eab`) deployed to `dpl_B7C6kWeBxkZ2s5QCSpzhF6T5vRsU` (`https://first-contact-language-builder-4w1py372e-sharm-07.vercel.app`) and aliased to `https://first-contact-language-builder.vercel.app`. |
| **Check 1 — `/api/health`** | **Passed** | `HTTP/2 200` — `ok: true`, `environment: "production"`, `database.provider: "postgresql"`, `database.migrated: true`, `storage.provider: "supabase"`, `storage.available: true`, `media.configured: true`, `rateLimit.provider: "database"`, `rateLimit.available: true`. |
| **Check 2 — Legacy Sample Credential & `SHORE-1001` Rejection** | **Passed** | `demo-shore-1001-participant-a` → **401**, `demo-shore-1001-participant-b` → **401**, `GET /api/sessions/SHORE-1001` → **404**, `POST /api/demo/reset` → **403**. |
| **Check 2b — Client HTML Secret Exposure** | **Passed** | `GET /start` → **200**, zero `service_role`, DB password, or signing secret leakage in rendered HTML; codebase search confirms zero client-side `supabase-js` or `NEXT_PUBLIC_*` Supabase credentials. |
| **Check 3 — Session Creation (Browser 1)** | **Passed** | Real headless Chrome (`Playwright`) on `/start` created throwaway session `WIND-7771` with 48-char seat token (`token_len=48`). |
| **Check 4 — Independent Join (Browser 2)** | **Passed** | Second isolated Playwright context joined `WIND-7771` seat `B` cleanly and rendered `/session/WIND-7771/community` (`seatB_visible=true`). |
| **Check 5 — Participant Draft Isolation** | **Passed** | Unlocked draft saved by Seat A stayed hidden from Seat B across browser UI reload and API state (`draftSaved=true`, `ui_leaked=false`, `api_leaked=false`). |
| **Check 6 — Evidence Upload & Signed Retrieval** | **Passed** | Uploaded PNG (`POST /api/sessions/WIND-7771/evidence` → **201**) to private Supabase Storage and fetched signed URL (`/api/media/<id>?exp=...&sig=...` → **200**, exact 68 bytes). |
| **Check 7 — Private Storage Rejection** | **Passed** | Direct unauthenticated request to Supabase public object URL (`storage/v1/object/public/session-media/...`) rejected (**HTTP 400**). |
| **Check 8 — Media Proxy Signing & Expiry** | **Passed** | Unsigned `/api/media/<id>` without token → **404**; tampered `sig` → **404**; expired `exp=1000` → **404**; valid HMAC signed URL → **200**. |
| **Check 9 — Cross-Session Access Denial** | **Passed** | Second throwaway session `BIRD-4039` (**201**) rejected when reading `WIND-7771` session (**404**), unsigned media (**404**), or tampered-sig media (**404**). |
| **Check 10 — Recovery Rotation & Revocation** | **Passed** | `POST /api/sessions/rejoin` (**200**) rotated Seat B's token; prior token failed (**401**), new token succeeded (**200**). |
| **Check 11 — Distributed Rate Limit (`429`)** | **Passed** | Repeated `POST /api/sessions/rejoin` requests enforced PostgreSQL-backed limit (`HTTP 429` within 19 requests, `X-RateLimit-Limit: 20`, `X-RateLimit-Remaining: 0`, `Retry-After: 796`). |
| **Check 12 — Throwaway Cleanup & Local Integrity** | **Passed** | Both throwaway sessions deleted (`WIND-7771`: `200`/`404` after; `BIRD-4039`: `200`/`404` after); `storage.objects` = `0` rows; local SQLite `SHORE-1001` untouched (`concepts: 8`, `evidence: 8`, `hypotheses: 11`, `participants: 2`). |

---

## 2. Hosted Infrastructure & Deployment Details

- **Supabase Organization**: `sharmao07's Org` (`lzpvmfofigehzavohwbs`, `free`)
- **Supabase Project**: `first-contact-production` (`mogsdvdgfwpsssvcjjoc`, `ap-southeast-2`, PostgreSQL `17.12.0.002`, API URL `https://mogsdvdgfwpsssvcjjoc.supabase.co`)
- **Private Storage Bucket**: `session-media` (`public: false`, `rls_enabled: true`, `0` permissive `anon`/`authenticated` policies; server-side access via `SUPABASE_SERVICE_ROLE_KEY` in `lib/storage/supabase.ts`)
- **Database Connection Tuning Fix Applied During Verification**:
  - Live testing on commit `924c914` uncovered Prisma pool exhaustion (`Timed out fetching a new connection from the connection pool (Current connection pool timeout: 10, connection limit: 1)`) due to concurrent `requireParticipant` / `loadSessionState` queries over Vercel (`iad1`) ↔ Supabase PgBouncer (`ap-southeast-2`).
  - Updated `lib/database/prisma.ts` to retain the singleton `PrismaClient` in `globalThis` across production lambda chunks, updated `scripts/check-env.mjs` to accept `connection_limit` `1`–`20` alongside `pgbouncer=true`, updated Vercel `DATABASE_URL` to `?pgbouncer=true&connection_limit=5&pool_timeout=25`, and updated `DIRECT_URL` to Supabase's IPv4 Session Pooler (`:5432`, without `pgbouncer=true`) because direct `db.<ref>.supabase.co:5432` is IPv6-only by default.
  - Verified unit/typecheck/lint suites (`11` test files, `90` tests passed; `tsc --noEmit` 0 errors; `eslint .` 0 errors) prior to deploying commit `478d527`.
- **Vercel Project**: `sharm-07/first-contact-language-builder`
- **Production Alias URL**: `https://first-contact-language-builder.vercel.app`
- **Deployed Production URL / ID**: `https://first-contact-language-builder-4w1py372e-sharm-07.vercel.app` (`dpl_B7C6kWeBxkZ2s5QCSpzhF6T5vRsU`, commit `478d527`)

---

## 3. Supabase Security Review & Advisor Findings

- `get_advisors` (`type: "security"`): returned `lints: []`.
- `list_tables` (`schemas: ["public", "storage"]`):
  - `storage.*`: RLS enabled on all storage tables (`rls_enabled: true`), `session-media` bucket is `public: false`, zero permissive `storage.objects` policies for `anon`/`authenticated`.
  - `public.*`: **`rls_disabled` critical advisory** reported across all **21** tables (`_prisma_migrations` and all 20 Prisma models).

---

## 4. Local Changes Committed & Pushed

- Commit `924c914`: `Harden Phase 1 production infrastructure, security, and rate limiting` (28 files)
- Commit `478d527`: `Tune Prisma serverless pool handling for PgBouncer latency` (`scripts/check-env.mjs`, `lib/database/prisma.ts`)
- Local SQLite (`data/first-contact.db`) `SHORE-1001` verified untouched (`concepts: 8`, `evidence: 8`, `hypotheses: 11`, `participants: 2`).

---

## 5. Remaining Security Risks & Next Actions

1. **CRITICAL — Enable RLS on `public` Schema Tables (or Disable `public` in Supabase Data API Settings):**
   - Because Supabase exposes `public` through PostgREST Data API by default, enabling RLS with no `anon`/`authenticated` policies blocks all external PostgREST client reads/writes while Prisma (which connects directly via `DATABASE_URL` as `postgres`, `rolbypassrls: true`) continues operating normally.
   - Review and run the SQL below in Supabase SQL Editor (or disable `public` under **Project Settings → Data API**):
     ```sql
     ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."DiscoverySession" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."Participant" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."Evidence" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."Concept" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."VocabularyEntry" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."ConceptHypothesis" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."ConceptRelationship" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."VerificationExperiment" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."VerificationResponse" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."LearningActivity" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."ActivityResponse" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."ResearchNote" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."SessionEvent" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."Expression" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."ExpressionConcept" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."CommunicationTask" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."IndependentResponse" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."ExperimentProposal" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."AccessCredential" ENABLE ROW LEVEL SECURITY;
     ALTER TABLE "public"."RateLimitBucket" ENABLE ROW LEVEL SECURITY;
     ```
2. **Signed Media URL Bearer Behavior**: By design for HTML `<img>`/`<audio>` rendering, `/api/media/[id]?exp=...&sig=...` authorizes access via the HMAC signature alone for the 15-minute TTL (`DEFAULT_TTL_SECONDS=900`), while unsigned/expired requests require a matching session `x-participant-token`.
3. **Vercel Preview Environment**: Environment variables are currently scoped to `Production` only; if Preview deployments are later used, attach a dedicated Preview Supabase project.
4. **Cross-Region Latency (`iad1` vs `ap-southeast-2`)**: Vercel functions currently execute in `iad1` (US East) against Supabase in `ap-southeast-2` (Sydney); moving Vercel function region or provisioning Upstash Redis (`RATE_LIMIT_STORE=redis`) is optional future optimization for Phase 2+.
5. **Commit This Final Report**: After completing the RLS lockdown review, commit and push the updated `PHASE-1-HOSTED-INFRASTRUCTURE-REPORT.md`.
