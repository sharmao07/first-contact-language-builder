import { json, readToken, run } from "@/lib/api/handlers";
import { updateConcept } from "@/lib/domain/discovery";
import { conceptPatchSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function PATCH(request: Request, context: { params: Promise<{ code: string; id: string }> }) {
  return run(async () => {
    const { code, id } = await context.params;
    return json(await updateConcept(code, readToken(request), id, conceptPatchSchema.parse(await request.json())));
  });
}
