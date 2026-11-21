import { json, readToken, run } from "@/lib/api/handlers";
import { deleteNote } from "@/lib/domain/checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function DELETE(request: Request, context: { params: Promise<{ code: string; id: string }> }) {
  return run(async () => {
    const { code, id } = await context.params;
    return json(await deleteNote(code, readToken(request), id));
  });
}
