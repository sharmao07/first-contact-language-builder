import { json, readToken, run } from "@/lib/api/handlers";
import { createConcept } from "@/lib/domain/discovery";
import { conceptCreateSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    return json(await createConcept(code, readToken(request), conceptCreateSchema.parse(await request.json())), 201);
  });
}
