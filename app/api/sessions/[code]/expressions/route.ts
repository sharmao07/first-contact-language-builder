import { json, readToken, run } from "@/lib/api/handlers";
import { createExpression } from "@/lib/domain/checks";
import { expressionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    return json(await createExpression(code, readToken(request), expressionSchema.parse(await request.json())), 201);
  });
}
