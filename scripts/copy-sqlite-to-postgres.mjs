import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

export const TABLES = [
  "DiscoverySession",
  "Participant",
  "AccessCredential",
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
  "CommunicationTask",
  "IndependentResponse",
  "ExperimentProposal",
];

export const BACKUP_PATH = "data/backups/first-contact-before-postgres-migration-20261124-220325.db";

const FOREIGN_KEYS = [
  ["Participant", "sessionId", "DiscoverySession", "id"],
  ["AccessCredential", "participantId", "Participant", "id"],
  ["Concept", "sessionId", "DiscoverySession", "id"],
  ["VocabularyEntry", "conceptId", "Concept", "id"],
  ["Evidence", "sessionId", "DiscoverySession", "id"],
  ["Evidence", "participantId", "Participant", "id"],
  ["ConceptHypothesis", "sessionId", "DiscoverySession", "id"],
  ["ConceptRelationship", "sessionId", "DiscoverySession", "id"],
  ["ConceptRelationship", "fromConceptId", "Concept", "id"],
  ["ConceptRelationship", "toConceptId", "Concept", "id"],
  ["VerificationExperiment", "sessionId", "DiscoverySession", "id"],
  ["VerificationExperiment", "conceptId", "Concept", "id"],
  ["VerificationResponse", "experimentId", "VerificationExperiment", "id"],
  ["VerificationResponse", "participantId", "Participant", "id"],
  ["LearningActivity", "sessionId", "DiscoverySession", "id"],
  ["ActivityResponse", "activityId", "LearningActivity", "id"],
  ["ActivityResponse", "participantId", "Participant", "id"],
  ["ResearchNote", "sessionId", "DiscoverySession", "id"],
  ["SessionEvent", "sessionId", "DiscoverySession", "id"],
  ["Expression", "sessionId", "DiscoverySession", "id"],
  ["ExpressionConcept", "expressionId", "Expression", "id"],
  ["ExpressionConcept", "conceptId", "Concept", "id"],
  ["CommunicationTask", "sessionId", "DiscoverySession", "id"],
  ["IndependentResponse", "sessionId", "DiscoverySession", "id"],
  ["IndependentResponse", "taskId", "CommunicationTask", "id"],
  ["IndependentResponse", "authorParticipantId", "Participant", "id"],
  ["ExperimentProposal", "sessionId", "DiscoverySession", "id"],
];

export class CopyRefused extends Error {
  constructor(message) {
    super(message);
    this.name = "CopyRefused";
  }
}

export function isSqliteFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const handle = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(16);
    fs.readSync(handle, header, 0, 16, 0);
    return header.toString("utf8", 0, 15) === "SQLite format 3";
  } finally {
    fs.closeSync(handle);
  }
}

export function quoteIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new CopyRefused("A column name was not safe to copy.");
  return `"${name}"`;
}

export function convertSqliteValue(value, postgresType) {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") value = Number(value);
  const type = postgresType.toLowerCase();
  if (type === "boolean" || type === "bool") return value === true || value === 1 || value === "1";
  if (type.includes("timestamp") || type === "date") {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return value;
    return new Date(numeric).toISOString();
  }
  return value;
}

function sqliteColumns(sqlite, table) {
  return sqlite.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all().map((row) => row.name);
}

function sqliteCount(sqlite, table) {
  return Number(sqlite.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdent(table)}`).get().count);
}

async function destinationColumns(query, table) {
  const rows = await query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
    [table],
  );
  return rows;
}

async function destinationCount(query, table) {
  const rows = await query(`SELECT COUNT(*)::int AS count FROM ${quoteIdent(table)}`);
  return Number(rows[0]?.count ?? 0);
}

export async function copySqliteDatabase({ sourcePath, backupPath = BACKUP_PATH, query }) {
  if (!isSqliteFile(sourcePath)) throw new CopyRefused("The source SQLite database is missing or unreadable. Nothing was copied.");
  if (!isSqliteFile(backupPath)) throw new CopyRefused("The required SQLite backup is missing. Nothing was copied.");
  const sourceStat = fs.statSync(sourcePath);
  const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
  const sourceCounts = Object.fromEntries(TABLES.map((table) => [table, sqliteCount(sqlite, table)]));

  for (const table of TABLES) {
    const columns = await destinationColumns(query, table);
    if (!columns.length) throw new CopyRefused(`Postgres has no ${table} table. Apply the migration first. Nothing was copied.`);
    const sourceNames = new Set(sqliteColumns(sqlite, table));
    for (const column of columns) {
      const required = String(column.is_nullable).toUpperCase() === "NO" && (column.column_default === null || column.column_default === undefined || column.column_default === "");
      if (required && !sourceNames.has(column.column_name)) {
        throw new CopyRefused(`Postgres column ${table}.${column.column_name} is required and missing from SQLite. Nothing was copied.`);
      }
    }
  }

  for (const table of TABLES) {
    if (await destinationCount(query, table) > 0) {
      throw new CopyRefused("Postgres already has rows. Refusing to overwrite or duplicate them. If a file upload was interrupted, rerun with COPY_FILES_ONLY=yes.");
    }
  }

  await query("BEGIN");
  try {
    for (const table of TABLES) {
      const rows = sqlite.prepare(`SELECT * FROM ${quoteIdent(table)}`).all();
      if (!rows.length) continue;
      const columns = await destinationColumns(query, table);
      const typeByColumn = new Map(columns.map((column) => [column.column_name, column.data_type]));
      for (const row of rows) {
        const names = Object.keys(row).filter((name) => typeByColumn.has(name));
        const values = names.map((name) => convertSqliteValue(row[name], typeByColumn.get(name)));
        const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
        await query(
          `INSERT INTO ${quoteIdent(table)} (${names.map(quoteIdent).join(", ")}) VALUES (${placeholders})`,
          values,
        );
      }
    }

    for (const table of TABLES) {
      const copied = await destinationCount(query, table);
      if (copied !== sourceCounts[table]) {
        throw new CopyRefused(`${table} count is ${copied} after copy and ${sourceCounts[table]} in SQLite. The copy was rolled back.`);
      }
    }

    for (const [child, childColumn, parent, parentColumn] of FOREIGN_KEYS) {
      const orphans = await query(
        `SELECT COUNT(*)::int AS count FROM ${quoteIdent(child)} AS child LEFT JOIN ${quoteIdent(parent)} AS parent ON parent.${quoteIdent(parentColumn)} = child.${quoteIdent(childColumn)} WHERE child.${quoteIdent(childColumn)} IS NOT NULL AND parent.${quoteIdent(parentColumn)} IS NULL`,
      );
      if (Number(orphans[0]?.count ?? 0) > 0) {
        throw new CopyRefused(`Foreign key ${child}.${childColumn} has rows without a parent. The copy was rolled back.`);
      }
    }

    const shore = await query(`SELECT COUNT(*)::int AS count FROM "Concept" AS concept JOIN "DiscoverySession" AS session ON session."id" = concept."sessionId" WHERE session."code" = 'SHORE-1001'`);
    const sourceShore = Number(sqlite.prepare(`SELECT COUNT(*) AS count FROM "Concept" AS concept JOIN "DiscoverySession" AS session ON session."id" = concept."sessionId" WHERE session."code" = 'SHORE-1001'`).get().count);
    if (Number(shore[0]?.count ?? 0) !== sourceShore) {
      throw new CopyRefused("SHORE-1001 concept count does not match the source. The copy was rolled back.");
    }
    const tokens = await query(`SELECT COUNT(*)::int AS count FROM "Participant"`);
    const distinct = await query(`SELECT COUNT(DISTINCT "token")::int AS count FROM "Participant"`);
    const blank = await query(`SELECT COUNT(*)::int AS count FROM "Participant" WHERE "token" IS NULL OR "token" = ''`);
    if (Number(tokens[0]?.count ?? 0) !== Number(distinct[0]?.count ?? 0) || Number(blank[0]?.count ?? 0) !== 0) {
      throw new CopyRefused("Participant recovery tokens were not preserved. The copy was rolled back.");
    }

    await query("COMMIT");
  } catch (error) {
    await query("ROLLBACK").catch(() => undefined);
    throw error;
  }

  if (fs.statSync(sourcePath).mtimeMs !== sourceStat.mtimeMs || fs.statSync(sourcePath).size !== sourceStat.size) {
    throw new CopyRefused("The source SQLite file changed size or time during the read. Postgres was committed, so inspect it before retrying.");
  }
  return { counts: sourceCounts, shoreConcepts: sourceShoreCount(sqlite) };
}

function sourceShoreCount(sqlite) {
  return Number(sqlite.prepare(`SELECT COUNT(*) AS count FROM "Concept" AS concept JOIN "DiscoverySession" AS session ON session."id" = concept."sessionId" WHERE session."code" = 'SHORE-1001'`).get().count);
}

function loadEnvFile() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

async function uploadLocalFiles() {
  if (process.env.STORAGE_PROVIDER?.trim().toLowerCase() !== "supabase") {
    console.log("STORAGE_PROVIDER is not supabase. Local upload files were left in data/uploads.");
    return;
  }
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "session-media";
  if (!base.startsWith("https://") || !key) {
    console.error("Storage credentials are incomplete. Database rows were copied. Files were not uploaded.");
    process.exitCode = 1;
    return;
  }
  const root = "data/uploads";
  if (!fs.existsSync(root)) {
    console.log("No local upload directory to copy.");
    return;
  }
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  walk(root);
  let uploaded = 0;
  for (const file of files) {
    const relative = file.slice(`${root}/`.length);
    if (!/^[A-Za-z0-9_./-]+$/.test(relative) || relative.includes("..")) {
      console.error("An upload path was not safe. Remaining files were not sent. Local files were not deleted.");
      process.exitCode = 1;
      return;
    }
    const response = await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/${relative.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        apikey: key,
        "content-type": "application/octet-stream",
        "x-upsert": "true",
      },
      body: fs.readFileSync(file),
    });
    if (!response.ok) {
      console.error(`Upload stopped after ${uploaded} file(s). Local files were not deleted.`);
      process.exitCode = 1;
      return;
    }
    uploaded += 1;
  }
  console.log(`Uploaded ${uploaded} file(s) to the private bucket. Local files were not deleted.`);
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
4. Create tables with npm run db:migrate. Do not run db:seed afterwards.
5. Re-run this script with CONFIRM_DATA_COPY=yes. It uses DIRECT_URL, not the pooled URL.
The local SQLite file is not modified. db:seed replaces the illustrative SHORE-1001 session, so do not seed after a copy if those rows should stay as they are.`);
}

async function main() {
  loadEnvFile();
  const source = sqlitePath();
  if (!isSqliteFile(source)) {
    console.error("The local SQLite file was not found. Nothing was copied.");
    process.exit(1);
  }
  const sqlite = new DatabaseSync(source, { readOnly: true });
  console.log(TABLES.map((table) => `${table}=${sqliteCount(sqlite, table)}`).join(" "));
  sqlite.close();

  const url = process.env.DIRECT_URL?.trim() ?? "";
  const postgres = url.startsWith("postgres://") || url.startsWith("postgresql://");
  if (process.env.COPY_FILES_ONLY === "yes") {
    if (!postgres || process.env.CONFIRM_DATA_COPY !== "yes") {
      console.error("File-only upload requires DIRECT_URL and CONFIRM_DATA_COPY=yes. Nothing was uploaded.");
      process.exit(1);
    }
    await uploadLocalFiles();
    return;
  }
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
    const summary = await copySqliteDatabase({
      sourcePath: source,
      query: async (sql, params = []) => {
        const result = await client.query(sql, params);
        return result.rows ?? [];
      },
    });
    console.log(`Copy committed. SHORE-1001 concepts: ${summary.shoreConcepts}. The SQLite file was not modified.`);
    await uploadLocalFiles();
  } catch (error) {
    console.error(error instanceof CopyRefused ? error.message : (error instanceof Error ? error.name : "Copy failed."));
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
