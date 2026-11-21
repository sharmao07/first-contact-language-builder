import { json, readToken, run } from "@/lib/api/handlers";
import { deleteSession, updateSession } from "@/lib/domain/session";
import { loadSessionState } from "@/lib/domain/serialize";
import { deleteSessionSchema, sessionPatchSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string }> };

export function GET(request: Request, context: Context) {
  return run(async () => {
    const { code } = await context.params;
    return json(await loadSessionState(code, readToken(request)));
  });
}

export function PATCH(request: Request, context: Context) {
  return run(async () => {
    const { code } = await context.params;
    const input = sessionPatchSchema.parse(await request.json());
    return json(await updateSession(code, readToken(request), input));
  });
}

export function DELETE(request: Request, context: Context) {
  return run(async () => {
    const { code } = await context.params;
    const input = deleteSessionSchema.parse(await request.json());
    return json(await deleteSession(code, readToken(request), input.confirmCode));
  });
}
