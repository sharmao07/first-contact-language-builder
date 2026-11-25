import { spawnSync } from "node:child_process";
import fs from "node:fs";

function loadEnvFile() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvFile();
const pooled = process.env.DATABASE_URL?.trim() ?? "";
const direct = process.env.DIRECT_URL?.trim() ?? "";
const postgres = (value) => value.startsWith("postgres://") || value.startsWith("postgresql://");

if (!postgres(pooled) || !postgres(direct)) {
  console.error("Refusing to migrate. DATABASE_URL and DIRECT_URL must both be Postgres URLs. The local SQLite database was not changed.");
  process.exit(1);
}
if (direct.includes("pgbouncer=true") || direct.includes(":6543")) {
  console.error("DIRECT_URL points at the pooler. Use the direct Supabase connection for migrations. Nothing was applied.");
  process.exit(1);
}
if (!pooled.includes("pgbouncer=true")) {
  console.error("DATABASE_URL is not marked as the pooler. Add pgbouncer=true&connection_limit=1. Nothing was applied.");
  process.exit(1);
}

const result = spawnSync(
  "./node_modules/.bin/prisma",
  ["migrate", "deploy", "--schema", "prisma/schema.postgresql.prisma"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
