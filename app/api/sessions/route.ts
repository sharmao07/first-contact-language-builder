import { json, readToken, run } from "@/lib/api/handlers";
import { createSession, listSessionsForToken } from "@/lib/domain/session";
import { createSessionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return run(async () => json({ sessions: await listSessionsForToken(readToken(request)) }));
}

export function POST(request: Request) {
  return run(async () => {
    const input = createSessionSchema.parse(await request.json());
    return json(await createSession(input), 201);
  });
}
