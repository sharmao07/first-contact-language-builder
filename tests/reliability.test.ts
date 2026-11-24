import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { databaseUnavailable, redactSecrets } from "@/lib/api/handlers";
import { healthHttpStatus } from "@/lib/health/report";
import { readUpload, removeUploadDir, writeUpload } from "@/lib/storage/files";
import { convertSqliteValue } from "../scripts/copy-sqlite-to-postgres.mjs";

describe("reliability guards", () => {
  it("does not answer 200 when the report is not ok", () => {
    expect(healthHttpStatus({ ok: false })).toBe(503);
    expect(healthHttpStatus({ ok: true })).toBe(200);
  });

  it("hides connection strings from logged errors", () => {
    const redacted = redactSecrets("connect postgres://user:secret@host/db and file:../data/first-contact.db Bearer abc.def.ghi");
    expect(redacted).not.toContain("secret");
    expect(redacted).not.toContain("first-contact.db");
    expect(redacted).toContain("[redacted]");
  });

  it("treats Prisma startup failures as database unavailability", () => {
    const error = new Error("bad url");
    error.name = "PrismaClientInitializationError";
    expect(databaseUnavailable(error)).toBe(true);
    expect(databaseUnavailable(Object.assign(new Error("down"), { code: "P1001" }))).toBe(true);
    expect(databaseUnavailable(new Error("validation"))).toBe(false);
  });

  it("converts SQLite dates and booleans for Postgres", () => {
    expect(convertSqliteValue(1_700_000_000_000, "timestamp without time zone")).toBe(new Date(1_700_000_000_000).toISOString());
    expect(convertSqliteValue(1, "boolean")).toBe(true);
    expect(convertSqliteValue(0, "boolean")).toBe(false);
    expect(convertSqliteValue("SHORE-1001", "text")).toBe("SHORE-1001");
  });

  it("keeps the Postgres schema on the same models as SQLite", () => {
    const strip = (file: string) =>
      fs
        .readFileSync(file, "utf8")
        .replace(/\/\/.*$/gm, "")
        .replace(/generator client \{[\s\S]*?\n\}\n/g, "")
        .replace(/datasource db \{[\s\S]*?\n\}\n/g, "")
        .trim();
    expect(strip("prisma/schema.postgresql.prisma")).toBe(strip("prisma/schema.prisma"));
  });
});

describe("local uploads", () => {
  const prefix = `audit-${Date.now()}`;
  const relative = path.posix.join(prefix, "glass.png");

  afterEach(async () => {
    await removeUploadDir(prefix);
  });

  it("stores and reads a file without leaving it after removal", async () => {
    const bytes = Buffer.from("png");
    await writeUpload(relative, bytes);
    expect(await readUpload(relative)).toEqual(bytes);
    await removeUploadDir(prefix);
    await expect(readUpload(relative)).rejects.toThrow();
  });
});
