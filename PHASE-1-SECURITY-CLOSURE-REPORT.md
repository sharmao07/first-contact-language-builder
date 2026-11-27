# Phase 1 — Security Closure Report (Supabase RLS, Privileges & Data API)

**Status:** **Closed & Verified.** All `21` tables in Supabase `public` now have Row Level Security enabled with zero `anon`/`authenticated` policies, direct table/sequence/function privileges and schema `CREATE` revoked from `PUBLIC`/`anon`/`authenticated`, future-object default privileges locked for `postgres` (both `public`-schema and database-global function defaults), and the Supabase Data API (`PostgREST` / `pg_graphql`) disabled. Both live PostgreSQL role-impersonation tests and the full `13/13` live production verification suite passed **after** all security changes.

---

## 1. Live Discovery & Architecture Verification (Step 1)

- **Application Codebase Audit**: Confirmed zero imports or usages of `@supabase/supabase-js`, `/rest/v1/`, `/graphql/v1`, or `NEXT_PUBLIC_*` Supabase keys across `package.json`, `app/`, `lib/`, `components/`, `prisma/`, and `scripts/`. All database traffic runs server-side through Prisma (`DATABASE_URL`), and [lib/storage/supabase.ts](file:///Users/ojussharma/Downloads/language/first-contact-language-builder/lib/storage/supabase.ts) calls `/storage/v1/` exclusively with server-only `SUPABASE_SERVICE_ROLE_KEY`.
- **Database Role & Schema Audit (`mogsdvdgfwpsssvcjjoc`, PostgreSQL `17.12.0.002`)**:
  - Production Prisma role `postgres` owns all `21` `public` tables and has `rolbypassrls = true` (`rolsuper = false`).
  - `anon` and `authenticated` have `rolbypassrls = false`.
  - Pre-hardening `public` objects: `21` tables (the `20` Prisma models + `_prisma_migrations`), `0` sequences, `0` views/materialized views, `0` functions, `0` triggers, `0` RLS policies.
  - **Pre-hardening vulnerability found**:
    1. All `21` `public` tables had `rowsecurity = false`.
    2. `anon` and `authenticated` held `TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN` (`Dxtm`) grants on all `21` `public` tables (`pg_class.relacl`).
    3. `pg_default_acl` for `postgres` in `public` granted `Dxtm` on future tables to `anon`/`authenticated`, and PostgreSQL's built-in global default granted `EXECUTE` on future functions to `PUBLIC`.
    4. Supabase Data API was **ON**, exposing `public` and `graphql_public` on `/rest/v1/` and `/graphql/v1` (`HTTP/2 200` on `/graphql/v1`).

---

## 2. Reproducible Migrations Applied (Steps 2, 3 & 5)

Existing migrations were left untouched; two additive, non-destructive migrations were created, verified in embedded PGlite, registered in [scripts/check-env.mjs](file:///Users/ojussharma/Downloads/language/first-contact-language-builder/scripts/check-env.mjs) (`REQUIRED_POSTGRES_MIGRATIONS`), and applied to `mogsdvdgfwpsssvcjjoc` via `npm run db:migrate`:

1. [20261127195500_harden_rls_and_privileges/migration.sql](file:///Users/ojussharma/Downloads/language/first-contact-language-builder/prisma/migrations/20261127195500_harden_rls_and_privileges/migration.sql)
   - Enables RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, without `FORCE ROW LEVEL SECURITY`) on all `20` Prisma tables and `_prisma_migrations`.
   - Creates **zero** policies for `anon` or `authenticated`.
   - Revokes `CREATE` on schema `public` and revokes `ALL PRIVILEGES` on all tables (including `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN`), sequences, and functions in `public` from `PUBLIC`, `anon`, and `authenticated`.
   - Alters `pg_default_acl` in schema `public` for migration owner `postgres` to revoke `ALL` on future tables, sequences, and functions from `PUBLIC`, `anon`, and `authenticated`.
2. [20261127200000_revoke_global_function_default_execute/migration.sql](file:///Users/ojussharma/Downloads/language/first-contact-language-builder/prisma/migrations/20261127200000_revoke_global_function_default_execute/migration.sql)
   - Live testing caught that PostgreSQL merges schema-level defaults with its database-global `PUBLIC EXECUTE` default on functions. This additive migration runs `ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` (and revokes `ALL` on functions from `anon` and `authenticated`), eliminating implicit `PUBLIC` execution on any future SQL/PLpgSQL function created by `postgres`.

**Recorded `_prisma_migrations` history on `mogsdvdgfwpsssvcjjoc`** (`prisma migrate status`: `Database schema is up to date!`):
- `20261124220325_init` (`finished: true`)
- `20261126213500_add_rate_limit_buckets` (`finished: true`)
- `20261127195500_harden_rls_and_privileges` (`finished: true`)
- `20261127200000_revoke_global_function_default_execute` (`finished: true`)

---

## 3. RLS, Grants & Default Privileges (Before vs. After)

| Scope | Before Hardening | After Hardening |
| --- | --- | --- |
| **RLS on all 21 `public` tables** | `rowsecurity = false` (Critical `rls_disabled`) | **`rowsecurity = true` on all 21 tables**, `0` policies (Advisor: `INFO` `rls_enabled_no_policy` only, `0` critical/warn lints) |
| **Table grants (`anon`, `authenticated`, `PUBLIC` on `public.*`)** | `anon=Dxtm`, `authenticated=Dxtm` (`TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN`) | **`0` rows** in `information_schema.role_table_grants`; `has_table_privilege` = `false` across all `21` tables × `7` operations |
| **Default privileges (`postgres`, schema `public`)** | Tables: `anon=Dxtm, authenticated=Dxtm` | Tables: `{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}`; Sequences: `{postgres=rwU/postgres}`; Functions: `{postgres=X/postgres}` |
| **Default privileges (`postgres`, `<GLOBAL>`)** | Built-in `PUBLIC=X` on functions | **`<GLOBAL>` functions: `{postgres=X/postgres}`** (verified rolled-back probe function got `proacl={postgres=X/postgres}`, `anon=f`, `authenticated=f`) |
| **Supabase-managed schemas (`storage`, `auth`, `realtime`)** | Standard Supabase ACLs | **Untouched** (`storage.objects` `rls_enabled = true`, private bucket intact) |

---

## 4. Data API Decision & Evidence (Step 4)

- **Decision**: Disabled **Enable Data API** in Supabase Dashboard (`https://supabase.com/dashboard/project/mogsdvdgfwpsssvcjjoc/integrations/data_api/overview`) because the application uses Prisma exclusively for PostgreSQL and `/storage/v1/` exclusively for Storage.
- **Post-Disable HTTP Checks**:
  - `GET /rest/v1/DiscoverySession?limit=1` (with `anon` key & Bearer): **HTTP 503** (Data API disabled)
  - `GET /rest/v1/`: **HTTP 401**
  - `POST /graphql/v1`: **HTTP 503** (GraphQL disabled)
  - `GET /storage/v1/bucket/session-media` (`service_role`): **HTTP 200** (`public: false`)
  - `GET /storage/v1/object/public/session-media/...` (unauthenticated): **HTTP 400** (bucket remains private)

---

## 5. Direct Unauthorized-Access & Live End-to-End Verification (Step 6)

### Direct PostgreSQL Role Impersonation & Future-Object Assertions (`prisma db execute`)
Executed as `postgres` on `mogsdvdgfwpsssvcjjoc` inside a transactional `DO $$` block switching to `SET LOCAL ROLE anon` and `SET LOCAL ROLE authenticated`:
- **Tested on both `anon` and `authenticated` roles**:
  - `SELECT` on `DiscoverySession`, `AccessCredential`, `_prisma_migrations` → **`insufficient_privilege`** (rejected)
  - `INSERT` on `RateLimitBucket` → **`insufficient_privilege`** (rejected)
  - `UPDATE` on `DiscoverySession` → **`insufficient_privilege`** (rejected)
  - `DELETE` on `DiscoverySession` → **`insufficient_privilege`** (rejected)
  - `TRUNCATE TABLE` on `RateLimitBucket` → **`insufficient_privilege`** (rejected)
- **Tested future objects inside a rolled-back probe transaction** (`CREATE TABLE "public"."_future_acl_probe" (id SERIAL PRIMARY KEY, v INT); CREATE FUNCTION "public"."_future_fn_probe"() ...`):
  - `has_table_privilege('anon' | 'authenticated', ..., 'SELECT' | 'TRUNCATE')` → **`false`**
  - `has_sequence_privilege('anon' | 'authenticated', ..., 'USAGE')` → **`false`**
  - `has_function_privilege('anon' | 'authenticated', ..., 'EXECUTE')` → **`false`**

### Live Application Verification After All Changes (`https://first-contact-language-builder.vercel.app`)
All `13/13` checks passed **after** RLS hardening, privilege revocation, and Data API disabling:
1. `GET /api/health` → **HTTP 200** (`postgresql` connected & migrated, `supabase` storage available, `media.configured: true`, `rateLimit` `database` available).
2. Legacy tokens (`demo-shore-1001-participant-a/b` → **401**, `SHORE-1001` → **404**, `/api/demo/reset` → **403**) & client HTML clean (**200**).
3. Two-browser Playwright creation (`BIRD-4915`), independent Seat B join, and private draft isolation across reload (`draftSaved=true`, `ui_leaked=false`, `api_leaked=false`).
4. Private Storage PNG upload (**201**), signed media proxy retrieval (**200**, `68` bytes), direct public bucket rejection (**400**), unsigned/tampered-sig/expired media rejection (**404**), cross-session denial (`SEED-2309` → **404**).
5. Recovery key rotation (`200`), prior token revocation (`401`), and distributed PostgreSQL rate limit (**HTTP 429** within 17 requests, `Retry-After: 638s`).
6. Throwaway sessions deleted cleanly (`BIRD-4915`, `SEED-2309`: `del=200/after=404`); production DB & storage left empty (`sessions: 0`, `buckets: 0`, `objects: 0`); local SQLite `SHORE-1001` untouched (`concepts: 8`, `evidence: 8`, `hypotheses: 11`, `participants: 2`).

### Local Automated Suite
- `npx vitest run`: **11 files, 90 tests passed** (includes all 4 migrations executing cleanly in embedded PGlite and confirming `rowsecurity === true` on all `20` schema tables).
- `npm run typecheck`: **0 errors** (`tsc --noEmit`).
- `npm run lint`: **0 errors** (`1` pre-existing warning in untouched `scripts/security-hardening.mjs:98`).
- `npm run env:check`: **passed**.

---

## 6. Remaining Operational Notes

- **Future Prisma Migrations**: Any newly added table in a future Prisma migration will automatically start with **zero** privileges for `PUBLIC`, `anon`, and `authenticated` via `ALTER DEFAULT PRIVILEGES`, and should still include `ALTER TABLE "public"."<NewTable>" ENABLE ROW LEVEL SECURITY;` to keep Supabase's security linter clean.
- **`supabase_admin` Default ACLs**: `pg_default_acl` entries owned by `supabase_admin` in `public` were left intact since `postgres` is non-superuser and Prisma runs exclusively as `postgres`.
- **Signed Media URLs**: `/api/media/[id]?exp=...&sig=...` remains intentionally usable as a short-lived (`15m`) HMAC-signed URL for `<img src>` / `<audio src>` rendering while unsigned or expired requests require a matching session `x-participant-token`.
