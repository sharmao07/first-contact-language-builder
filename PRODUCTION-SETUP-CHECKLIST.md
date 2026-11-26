# Production Setup Checklist

Manual dashboard steps required before First-Contact Language Builder can accept real sessions on Vercel (`https://first-contact-language-builder.vercel.app`). Local development continues to use SQLite (`DATABASE_URL="file:../data/first-contact.db"`) and `STORAGE_PROVIDER="local"`.

---

## 1. Create Supabase Project & PostgreSQL Connection Strings

1. In the **Supabase Dashboard**, create a dedicated **Production** project (use a separate project for **Preview** if preview deployments are enabled).
2. Open **Project Settings -> Database -> Connection string**:
   - Copy the **Transaction Pooler** URI (port `6543`) and ensure it ends with `?pgbouncer=true&connection_limit=1`. This becomes `DATABASE_URL`.
   - Copy the **Direct Connection** URI (port `5432`, without `pgbouncer=true`). This becomes `DIRECT_URL`.
3. Never commit `DATABASE_URL` or `DIRECT_URL` to Git, and never place them in `.env` for local development.

---

## 2. Create Private Supabase Storage Bucket

1. In **Supabase Dashboard -> Storage**, click **New bucket**.
2. Name the bucket `session-media` (or your chosen slug matching `^[a-z0-9][a-z0-9-]{1,60}$`).
3. Leave **Public bucket** **OFF** (private bucket required; `/api/health` and uploads reject public buckets).
4. In **Project Settings -> API**, copy:
   - **Project URL** (`https://<project-ref>.supabase.co`) -> `SUPABASE_URL`
   - **`service_role` secret key** -> `SUPABASE_SERVICE_ROLE_KEY` (keep strictly server-only; never use `NEXT_PUBLIC_*`).

---

## 3. Generate Server-Only Signing Secret

Generate a random secret of at least 32 characters:

```bash
openssl rand -hex 32
```

Set the output as `MEDIA_SIGNING_SECRET`.

---

## 4. Configure Distributed Rate Limiting

Two distributed backends are supported on Vercel serverless (in-memory rate limiting is never used):

- **Option A — Database-backed (default, zero extra service required):**
  Leave `RATE_LIMIT_STORE="auto"` (or `"database"`). Uses the `RateLimitBucket` table created by migration `20261126213500_add_rate_limit_buckets`.
- **Option B — Upstash Redis / Vercel KV REST (recommended under heavy traffic):**
  Provision an Upstash Redis / Vercel KV store and set `RATE_LIMIT_STORE="redis"`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` and `KV_REST_API_TOKEN`).

Configurable action limits (defaults apply if omitted):
- `RATE_LIMIT_SESSION_CREATE_MAX=20`, `RATE_LIMIT_SESSION_CREATE_WINDOW_SEC=900`
- `RATE_LIMIT_SESSION_JOIN_MAX=30`, `RATE_LIMIT_SESSION_JOIN_WINDOW_SEC=900`
- `RATE_LIMIT_SESSION_REJOIN_MAX=20`, `RATE_LIMIT_SESSION_REJOIN_WINDOW_SEC=900`
- `RATE_LIMIT_EVIDENCE_UPLOAD_MAX=60`, `RATE_LIMIT_EVIDENCE_UPLOAD_WINDOW_SEC=900`
- `RATE_LIMIT_AI_MAX=40`, `RATE_LIMIT_AI_WINDOW_SEC=900`

---

## 5. Apply Non-Destructive PostgreSQL Migrations

Run once from a clean shell with the production `DATABASE_URL` and `DIRECT_URL` exported (never run `prisma db seed` against production):

```bash
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

DATABASE_URL="<POOLED_POSTGRES_URL>" \
DIRECT_URL="<DIRECT_POSTGRES_URL>" \
npm run db:migrate
```

Both migrations are create-only:
1. `prisma/migrations/20261124220325_init/migration.sql`
2. `prisma/migrations/20261126213500_add_rate_limit_buckets/migration.sql`

> **Do NOT run `npm run db:seed` or `prisma db seed` against production.** `prisma/seed.ts` refuses to seed `SHORE-1001` reusable sample tokens into PostgreSQL/hosted deployments.

---

## 6. Configure Vercel Environment Variables

In **Vercel Dashboard -> Project -> Settings -> Environment Variables** (scope to **Production** and **Preview** separately with separate Supabase projects):

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled Supabase URI (`:6543/...?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Yes | Direct Supabase URI (`:5432/...`, no `pgbouncer=true`) |
| `STORAGE_PROVIDER` | Yes | Must be `supabase` |
| `SUPABASE_URL` | Yes | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only service role key (never `NEXT_PUBLIC_*`) |
| `SUPABASE_STORAGE_BUCKET` | Yes | Private bucket name (e.g. `session-media`) |
| `MEDIA_SIGNING_SECRET` | Yes | Random hex string (`>= 16` chars, 32+ recommended) |
| `RATE_LIMIT_STORE` | Yes | `auto`, `database`, or `redis` |
| `AI_PROVIDER` | Yes | `demo` (default) or `openai` |
| `OPENAI_API_KEY` | If `AI_PROVIDER=openai` | Server-only API key |
| `UPSTASH_REDIS_REST_URL` | If `RATE_LIMIT_STORE=redis` | `https://...` Upstash/KV REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | If `RATE_LIMIT_STORE=redis` | Server-only Redis REST token |
| `ALLOW_DEMO_OPERATOR` | No | Leave unset / empty in production |

Redeploy the Vercel project after saving variables so the build step (`node scripts/prepare-prisma.mjs && next build`) generates the PostgreSQL Prisma Client.

---

## 7. Post-Deploy Verification Commands

```bash
# 1. Confirm HTTP 200 and healthy Postgres, private Supabase bucket, media signing, and rate limiter:
curl -sS -i https://first-contact-language-builder.vercel.app/api/health

# 2. Confirm legacy sample credentials are rejected:
curl -sS -i -H "x-participant-token: demo-shore-1001-participant-a" \
  https://first-contact-language-builder.vercel.app/api/sessions

# 3. Smoke test create -> join -> upload -> signed media -> delete against production:
SMOKE_BASE=https://first-contact-language-builder.vercel.app npm run smoke
```
