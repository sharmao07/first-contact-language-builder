import fs from "node:fs";

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

  if (target === "development") {
    if (!database.startsWith("file:")) problems.push("DATABASE_URL must be a SQLite file URL for local development.");
    if (storage !== "local") problems.push("STORAGE_PROVIDER must be local for local development.");
    if (direct) problems.push("DIRECT_URL must stay unset while local development uses SQLite.");
  } else if (target === "preview" || target === "production") {
    if (!postgres(database)) problems.push("DATABASE_URL must be the pooled Postgres URL.");
    else if (!database.includes("pgbouncer=true") || !database.includes("connection_limit=1")) {
      problems.push("DATABASE_URL must include pgbouncer=true and connection_limit=1.");
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
  if (result.ok) {
    console.log(`${target} environment has the required variables.`);
  } else {
    for (const problem of result.problems) console.error(problem);
    process.exit(1);
  }
}
