export type SyncTransport = "stream" | "poll";

export function syncTransport(): SyncTransport {
  const choice = process.env.SYNC_TRANSPORT?.trim().toLowerCase();
  if (choice === "poll" || choice === "stream") return choice;
  // A Vercel function ends at its duration limit. The session stream would be cut off,
  // and holding it open also occupies a pooled database connection. Polling stays inside one request.
  if (process.env.VERCEL === "1") return "poll";
  return "stream";
}
