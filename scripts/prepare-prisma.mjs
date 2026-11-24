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
const url = process.env.DATABASE_URL?.trim() ?? "";
const postgres = url.startsWith("postgres://") || url.startsWith("postgresql://");
if (postgres && !process.env.DIRECT_URL?.trim()) {
  console.error("DIRECT_URL is required when DATABASE_URL is Postgres. Use the direct Supabase connection for migrations.");
  process.exit(1);
}
const schema = postgres ? "prisma/schema.postgresql.prisma" : "prisma/schema.prisma";
const result = spawnSync("./node_modules/.bin/prisma", ["generate", "--schema", schema], { stdio: "inherit" });
process.exit(result.status ?? 1);
