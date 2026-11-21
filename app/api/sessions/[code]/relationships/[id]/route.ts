import { json, readToken, run } from "@/lib/api/handlers";
import { deleteRelationship, updateRelationship } from "@/lib/domain/checks";
import { relationshipPatchSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string; id: string }> };

export function PATCH(request: Request, context: Context) {
  return run(async () => {
    const { code, id } = await context.params;
    return json(await updateRelationship(code, readToken(request), id, relationshipPatchSchema.parse(await request.json())));
  });
}

export function DELETE(request: Request, context: Context) {
  return run(async () => {
    const { code, id } = await context.params;
    return json(await deleteRelationship(code, readToken(request), id));
  });
}
