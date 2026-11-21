import { json, readToken, run } from "@/lib/api/handlers";
import { createRelationship } from "@/lib/domain/checks";
import { relationshipSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    return json(await createRelationship(code, readToken(request), relationshipSchema.parse(await request.json())), 201);
  });
}
