# Supabase setup

This file contains no credentials. Create the project yourself, then put the values only in Vercel environment variables or a local shell for the one copy command. Do not commit them. Do not put the service-role key in a `NEXT_PUBLIC_` variable.

Preview and Production need two Supabase projects. The names below use Production. Repeat every step in the Preview project and assign those values to the Vercel Preview environment only.

Local development stays on SQLite. Do not put a Postgres URL in the local `.env`.

## 1. Create the project

In the Supabase dashboard, create a new project. Choose a region close to the Vercel region. Save the database password in a password manager. This repository never stores it.

## 2. Find the connection strings

Open Project Settings, then Database, then Connection string.

Copy two URIs:

- Transaction pooler, port `6543`. This is the runtime URL.
- Direct connection, port `5432`. This is the migration URL.

## 3. Runtime URL

The pooled URL is `DATABASE_URL`. It must include the pooler flags:

```text
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

Prisma uses this for the running app. One connection is the Hobby limit.

## 4. Migration URL

The direct URL is `DIRECT_URL`. It must not contain `pgbouncer=true` and it must not use port `6543`.

```text
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

`npm run db:migrate` refuses to run if these two URLs are swapped or if either one is still SQLite.

## 5. Create the private bucket

Open Storage, then New bucket. Name it `session-media`. Leave it private. Do not add a public policy. The app reads objects with the service role and gives participants a short signed application URL.

## 6. Service-role key

Open Project Settings, then API. Copy the `service_role` secret. It bypasses row security, so it stays on the server. The anon key is not used.

## 7. Environment variables

Check names without printing values:

```bash
npm run env:check development
```

For a production shell that already has the variables:

```bash
npm run env:check production
```

Set these on Vercel for Production, and a different set for Preview:

```bash
vercel env add DATABASE_URL production --scope sharm-07 --project first-contact-language-builder
vercel env add DIRECT_URL production --scope sharm-07 --project first-contact-language-builder
vercel env add STORAGE_PROVIDER production --scope sharm-07 --project first-contact-language-builder
vercel env add SUPABASE_URL production --scope sharm-07 --project first-contact-language-builder
vercel env add SUPABASE_SERVICE_ROLE_KEY production --scope sharm-07 --project first-contact-language-builder
vercel env add SUPABASE_STORAGE_BUCKET production --scope sharm-07 --project first-contact-language-builder
vercel env add MEDIA_SIGNING_SECRET production --scope sharm-07 --project first-contact-language-builder
```

`STORAGE_PROVIDER` is `supabase`. `SUPABASE_STORAGE_BUCKET` is `session-media`. `MEDIA_SIGNING_SECRET` is a random string of at least 16 characters, different for Preview and Production. Optional: `MEDIA_URL_TTL_SECONDS=900` and `AI_PROVIDER=demo`.

Do not run these commands until the values exist. This session did not set them.

## 8. Migrate the database

From a shell that has both URLs:

```bash
npm run db:migrate
```

This applies `prisma/migrations/20261124220325_init/migration.sql` with `prisma migrate deploy`. It creates tables. It does not delete rows and it does not open the SQLite file.

## 9. Copy the local database and media

The source is `data/first-contact.db`. The required backup is `data/backups/first-contact-before-postgres-migration-20261124-220325.db`. The copy refuses to start if either file is missing, and it refuses to write if any destination table already has rows.

```bash
CONFIRM_DATA_COPY=yes npm run db:copy
```

The command uses `DIRECT_URL`. It compares row counts and foreign keys before commit. It then uploads `data/uploads` into the private bucket. It does not delete the SQLite file or the local uploads.

If the database committed and the upload stopped, rerun the files without inserting rows again:

```bash
CONFIRM_DATA_COPY=yes COPY_FILES_ONLY=yes npm run db:copy
```

## 10. Test the deployment

After the variables exist, deploy only when you intend to. Then:

```bash
curl -sS -D - https://first-contact-language-builder.vercel.app/api/health
```

A ready deployment returns `"ok": true` and `"database": {"connected": true}`. `ok: true` with no database field is the old deployment. Open `SHORE-1001`, confirm eight concepts, and walk one new session with two browsers. Delete only that new session.

## 11. Roll back

Do not run `prisma migrate reset`. Do not run `npm run db:seed` on the copied database. Seeding replaces `SHORE-1001`.

To leave the new deployment unused, remove the Production environment variables in Vercel and redeploy the previous known deployment from the Vercel dashboard. The local SQLite file remains the source copy. Postgres rows stay where they are until you delete that Supabase project yourself.

## 12. Preview and Production

Create a second Supabase project for Preview. Repeat the bucket, URL, and key steps. Add the same variable names with `vercel env add ... preview`. Use a different `MEDIA_SIGNING_SECRET`. Do not reuse the Production database password, pooler URL, or service-role key.
