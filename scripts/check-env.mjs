import fs from "node:fs";

const SECRET_KEY_PATTERNS = [
  "SERVICE_ROLE",
  "SIGNING_SECRET",
  "OPENAI_API_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "REDIS",
  "KV_REST_API_TOKEN",
  "DEMO_OPERATOR_SECRET",
];

export const REQUIRED_POSTGRES_MIGRATIONS = [
  "prisma/migrations/20261124220325_init/migration.sql",
  "prisma/migrations/20261126213500_add_rate_limit_buckets/migration.sql",
];

export function verifyMigrationsReady(root = ".") {
  const missing = REQUIRED_POSTGRES_MIGRATIONS.filter((file) => !fs.existsSync(`${root}/${file}`));
  return { ok: missing.length === 0, missing };
}

export function assessEnvironment(env, target = "development") {
  const problems = [];
  const value = (name) => (env[name] ?? "").trim();
  const postgres = (url) => url.startsWith("postgres://") || url.startsWith("postgresql://");
  const database = value("DATABASE_URL");
  const direct = value("DIRECT_URL");
  const storage = value("STORAGE_PROVIDER").toLowerCase() || "local";
  const supabaseUrl = value("SUPABASE_URL");
  const serviceRole = value("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = value("SUPABASE_STORAGE_BUCKET") || "session-media";
  const signing = value("MEDIA_SIGNING_SECRET");
  const provider = value("AI_PROVIDER").toLowerCase() || "demo";
  const rateLimitStore = value("RATE_LIMIT_STORE").toLowerCase() || "auto";
  const redisUrl = value("UPSTASH_REDIS_REST_URL") || value("KV_REST_API_URL");
  const redisToken = value("UPSTASH_REDIS_REST_TOKEN") || value("KV_REST_API_TOKEN");

  // Never allow server secrets inside NEXT_PUBLIC_* variables.
  const serverSecrets = [
    serviceRole,
    signing,
    value("OPENAI_API_KEY"),
    database,
    direct,
    redisToken,
    value("DEMO_OPERATOR_SECRET"),
  ].filter((item) => item.length >= 8);

  for (const [key, rawVal] of Object.entries(env)) {
    if (!key.startsWith("NEXT_PUBLIC_")) continue;
    const pubVal = String(rawVal ?? "").trim();
    if (!pubVal) continue;
    if (SECRET_KEY_PATTERNS.some((pattern) => key.toUpperCase().includes(pattern))) {
      problems.push(`${key} must not be exposed as a NEXT_PUBLIC_* variable.`);
    }
    if (serverSecrets.some((secret) => pubVal === secret)) {
      problems.push(`${key} duplicates a server-only secret.`);
    }
  }

  if (["memory", "off", "none"].includes(rateLimitStore)) {
    problems.push("RATE_LIMIT_STORE cannot be in-memory or disabled. Use auto, database, or redis.");
  } else if (!["auto", "database", "redis"].includes(rateLimitStore)) {
    problems.push("RATE_LIMIT_STORE must be auto, database, or redis.");
  }

  if (rateLimitStore === "redis" || redisUrl || redisToken) {
    if (!redisUrl.startsWith("https://")) problems.push("UPSTASH_REDIS_REST_URL (or KV_REST_API_URL) must be an https URL.");
    if (!redisToken) problems.push("UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_TOKEN) is missing.");
  }

  if (target === "development") {
    if (!database.startsWith("file:")) problems.push("DATABASE_URL must be a SQLite file URL for local development.");
    if (storage !== "local") problems.push("STORAGE_PROVIDER must be local for local development.");
    if (direct) problems.push("DIRECT_URL must stay unset while local development uses SQLite.");
  } else if (target === "preview" || target === "production") {
    if (!postgres(database)) problems.push("DATABASE_URL must be the pooled Postgres URL.");
    else if (!database.includes("pgbouncer=true") || !/[?&]connection_limit=([1-9]|1[0-9]|20)\b/.test(database)) {
      problems.push("DATABASE_URL must include pgbouncer=true and connection_limit (1-20, e.g. connection_limit=5).");
    }
    if (!postgres(direct)) problems.push("DIRECT_URL must be the direct Postgres URL.");
    else if (direct.includes("pgbouncer=true") || direct.includes(":6543")) {
      problems.push("DIRECT_URL points at the pooler. Use the direct connection for migrations.");
    }
    if (storage !== "supabase") problems.push("STORAGE_PROVIDER must be supabase. Local disk is not a production fallback.");
    if (!supabaseUrl.startsWith("https://")) problems.push("SUPABASE_URL must be an https URL.");
    if (!serviceRole) problems.push("SUPABASE_SERVICE_ROLE_KEY is missing.");
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(bucket)) problems.push("SUPABASE_STORAGE_BUCKET must be a private bucket name.");
    if (signing.length < 16) problems.push("MEDIA_SIGNING_SECRET must be at least 16 characters.");
    if (value("ALLOW_DEMO_OPERATOR") === "1") {
      problems.push("ALLOW_DEMO_OPERATOR must not be enabled in preview or production.");
    }
  } else {
    problems.push("Target must be development, preview, or production.");
  }

  if (provider === "openai" && !value("OPENAI_API_KEY")) problems.push("AI_PROVIDER is openai but OPENAI_API_KEY is missing.");
  else if (provider !== "openai" && provider !== "demo") problems.push("AI_PROVIDER must be demo or openai.");

  return { target, ok: problems.length === 0, problems };
}

function fileEnv() {
  const env = { ...process.env };
  if (!fs.existsSync(".env")) return env;
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || env[match[1]] !== undefined) continue;
    env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

if (process.argv[1]?.endsWith("check-env.mjs")) {
  const target = process.argv[2] || (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production" ? process.env.VERCEL_ENV : "development");
  const result = assessEnvironment(fileEnv(), target);
  const migrations = verifyMigrationsReady();
  const problems = [...result.problems];
  if (!migrations.ok) {
    problems.push(`Missing PostgreSQL migration files: ${migrations.missing.join(", ")}`);
  }
  if (problems.length === 0) {
    console.log(`${target} environment and migrations are valid.`);
  } else {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
