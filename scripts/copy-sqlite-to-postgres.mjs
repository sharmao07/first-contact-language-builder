import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const TABLES = [
  "DiscoverySession",
  "Participant",
  "Concept",
  "VocabularyEntry",
  "Evidence",
  "ConceptHypothesis",
  "ConceptRelationship",
  "VerificationExperiment",
  "VerificationResponse",
  "LearningActivity",
  "ActivityResponse",
  "ResearchNote",
  "SessionEvent",
  "Expression",
  "ExpressionConcept",
];

export function convertSqliteValue(value, postgresType) {
  if (value === null || value === undefined) return null;
  const type = postgresType.toLowerCase();
  if (type === "boolean" || type === "bool") return value === true || value === 1 || value === "1";
  if (type.includes("timestamp") || type === "date") {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return value;
    return new Date(numeric).toISOString();
  }
  return value;
}

function loadEnvFile() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

function sqlitePath() {
  const configured = process.env.SQLITE_PATH?.trim();
  if (configured) return configured;
  return "data/first-contact.db";
}

function instructions() {
  console.log(`SQLite to Postgres copy did not run.
1. In Supabase, create a project and a private Storage bucket.
2. Set DATABASE_URL to the pooled Postgres URL and DIRECT_URL to the direct URL.
3. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET. Keep the service role on the server only.
4. Generate the Postgres client and create tables:
   DATABASE_URL=... DIRECT_URL=... ./node_modules/.bin/prisma db push --schema prisma/schema.postgresql.prisma
5. Re-run this script with CONFIRM_DATA_COPY=yes after installing the pg package.
The local SQLite file is not modified. db:seed replaces the illustrative SHORE-1001 session, so do not seed after a copy if those rows should stay as they are.`);
}

async function main() {
  loadEnvFile();
  const source = sqlitePath();
  if (!fs.existsSync(source)) {
    console.error("The local SQLite file was not found. Nothing was copied.");
    process.exit(1);
  }
  const sqlite = new DatabaseSync(source, { readOnly: true });
  const counts = TABLES.map((table) => {
    const row = sqlite.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get();
    return `${table}=${row.count}`;
  });
  console.log(counts.join(" "));

  const url = process.env.DATABASE_URL?.trim() ?? "";
  const postgres = url.startsWith("postgres://") || url.startsWith("postgresql://");
  if (!postgres || process.env.CONFIRM_DATA_COPY !== "yes") {
    instructions();
    process.exit(2);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("The pg package is not installed. Local SQLite was not modified.");
    process.exit(2);
  }

  const client = new pg.default.Client({ connectionString: url });
  await client.connect();
  try {
    const existing = await client.query('SELECT COUNT(*)::int AS count FROM "DiscoverySession"');
    if (existing.rows[0].count > 0) {
      console.error("Postgres already has sessions. Refusing to mix copies. Nothing was written.");
      process.exit(1);
    }
    await client.query("BEGIN");
    for (const table of TABLES) {
      const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
      if (!rows.length) continue;
      const types = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        [table],
      );
      const typeByColumn = new Map(types.rows.map((row) => [row.column_name, row.data_type]));
      for (const row of rows) {
        const columns = Object.keys(row).filter((column) => typeByColumn.has(column));
        const values = columns.map((column) => convertSqliteValue(row[column], typeByColumn.get(column)));
        const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
        const quoted = columns.map((column) => `"${column}"`).join(", ");
        await client.query(`INSERT INTO "${table}" (${quoted}) VALUES (${placeholders})`, values);
      }
    }
    await client.query("COMMIT");
    console.log("Copy committed. The SQLite file was not modified.");
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Copy rolled back. The SQLite file was not modified.");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("copy-sqlite-to-postgres.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.name : "Copy failed.");
    process.exit(1);
  });
}
