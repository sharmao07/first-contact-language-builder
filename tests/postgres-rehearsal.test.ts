import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { getObjectStore } from "@/lib/storage";
import { mediaTtlSeconds, signMediaPath, mediaSignatureValid } from "@/lib/media/sign";
import { assessEnvironment } from "../scripts/check-env.mjs";
import { CopyRefused, copySqliteDatabase, quoteIdent } from "../scripts/copy-sqlite-to-postgres.mjs";

const sourcePath = "data/first-contact.db";
const migrationPath = "prisma/migrations/20261124220325_init/migration.sql";
const original = { vercel: process.env.VERCEL, ttl: process.env.MEDIA_URL_TTL_SECONDS, secret: process.env.MEDIA_SIGNING_SECRET, database: process.env.DATABASE_URL };

afterEach(() => {
  process.env.VERCEL = original.vercel;
  process.env.MEDIA_URL_TTL_SECONDS = original.ttl;
  process.env.MEDIA_SIGNING_SECRET = original.secret;
  process.env.DATABASE_URL = original.database;
});

describe("embedded postgres rehearsal", () => {
  it("copies SHORE-1001 once and refuses a second copy", async () => {
    const before = fs.statSync(sourcePath);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fclb-pg-rehearsal-"));
    const backupPath = path.join(tempDir, "backup.db");
    const missingBackupPath = path.join(tempDir, "missing-backup.db");
    fs.copyFileSync(sourcePath, backupPath);
    const backupBefore = fs.statSync(backupPath);
    const db = new PGlite();
    try {
      await db.exec(fs.readFileSync(migrationPath, "utf8"));
      const query = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as Array<Record<string, unknown>>;
      await expect(copySqliteDatabase({ sourcePath, backupPath: missingBackupPath, query })).rejects.toBeInstanceOf(CopyRefused);
      const summary = await copySqliteDatabase({ sourcePath, backupPath, query });
      expect(summary.counts.DiscoverySession).toBe(1);
      expect(summary.counts.Concept).toBe(8);
      expect(summary.shoreConcepts).toBe(8);
      const shore = await query(`SELECT code, purpose FROM "DiscoverySession" WHERE code = 'SHORE-1001'`);
      expect(shore[0]?.code).toBe("SHORE-1001");
      expect(shore[0]?.purpose).toBe("general");
      const evidence = await query(`SELECT COUNT(*)::int AS count FROM "Evidence" AS evidence JOIN "DiscoverySession" AS session ON session.id = evidence."sessionId" WHERE session.code = 'SHORE-1001'`);
      expect(Number(evidence[0]?.count)).toBe(summary.counts.Evidence);
      await expect(copySqliteDatabase({ sourcePath, backupPath, query })).rejects.toBeInstanceOf(CopyRefused);
      const after = fs.statSync(sourcePath);
      const backupAfter = fs.statSync(backupPath);
      expect(after.size).toBe(before.size);
      expect(after.mtimeMs).toBe(before.mtimeMs);
      expect(backupAfter.size).toBe(backupBefore.size);
    } finally {
      await db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe("migration safety", () => {
  it("uses a create-only migration", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toContain('CREATE TABLE "DiscoverySession"');
    expect(sql).toContain('CREATE TABLE "ExperimentProposal"');
    expect(sql.toLowerCase()).not.toContain("drop table");
    expect(sql.toLowerCase()).not.toContain("truncate");
    expect(sql.toLowerCase()).not.toContain("delete from");
  });

  it("rejects unsafe identifiers", () => {
    expect(quoteIdent("sessionId")).toBe('"sessionId"');
    expect(() => quoteIdent('id"; drop')).toThrow(CopyRefused);
  });
});

describe("environment and storage guards", () => {
  it("accepts local sqlite and rejects production disk storage", () => {
    expect(assessEnvironment({
      DATABASE_URL: "file:../data/first-contact.db",
      STORAGE_PROVIDER: "local",
      AI_PROVIDER: "demo",
    }, "development").ok).toBe(true);
    const production = assessEnvironment({
      DATABASE_URL: "postgresql://user:secret@db.example:6543/postgres?pgbouncer=true&connection_limit=1",
      DIRECT_URL: "postgresql://user:secret@db.example:5432/postgres",
      STORAGE_PROVIDER: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-only-key",
      SUPABASE_STORAGE_BUCKET: "session-media",
      MEDIA_SIGNING_SECRET: "0123456789abcdef",
      AI_PROVIDER: "demo",
    }, "production");
    expect(production.ok).toBe(false);
    expect(production.problems.join(" ")).toContain("supabase");
    expect(production.problems.join(" ")).not.toContain("secret");
  });

  it("does not fall back to local disk on Vercel", () => {
    process.env.VERCEL = "1";
    process.env.DATABASE_URL = "file:../data/first-contact.db";
    delete process.env.STORAGE_PROVIDER;
    expect(() => getObjectStore()).toThrow(/not configured/);
  });

  it("expires private media links on a short configurable lifetime", () => {
    process.env.MEDIA_SIGNING_SECRET = "0123456789abcdef";
    delete process.env.MEDIA_URL_TTL_SECONDS;
    expect(mediaTtlSeconds()).toBe(15 * 60);
    const path = signMediaPath("evidence-1", 1_700_000_000_000);
    const url = new URL(path ?? "", "http://local");
    const sixteenMinutes = 1_700_000_000_000 + 16 * 60 * 1000;
    expect(mediaSignatureValid("evidence-1", url.searchParams.get("exp"), url.searchParams.get("sig"), sixteenMinutes)).toBe(false);
  });
});
