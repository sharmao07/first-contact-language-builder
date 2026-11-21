import { json, run } from "@/lib/api/handlers";
import { createSession, listSessions } from "@/lib/domain/session";
import { createSessionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return run(async () => json({ sessions: await listSessions() }));
}

export function POST(request: Request) {
  return run(async () => {
    const input = createSessionSchema.parse(await request.json());
    return json(await createSession(input), 201);
  });
}
