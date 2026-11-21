import { json, readToken, run } from "@/lib/api/handlers";
import { updateExpression } from "@/lib/domain/checks";
import { expressionPatchSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function PATCH(request: Request, context: { params: Promise<{ code: string; id: string }> }) {
  return run(async () => {
    const { code, id } = await context.params;
    return json(await updateExpression(code, readToken(request), id, expressionPatchSchema.parse(await request.json())));
  });
}
