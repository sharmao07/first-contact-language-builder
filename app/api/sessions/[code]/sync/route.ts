import { json, readToken, run } from "@/lib/api/handlers";
import { syncSession } from "@/lib/domain/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    const since = Number(new URL(request.url).searchParams.get("revision") ?? "0");
    return json(await syncSession(code, readToken(request), Number.isFinite(since) ? since : 0));
  });
}
