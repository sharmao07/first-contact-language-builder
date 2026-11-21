import { json, readToken, run } from "@/lib/api/handlers";
import { leaveSession } from "@/lib/domain/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    return json(await leaveSession(code, readToken(request)));
  });
}
