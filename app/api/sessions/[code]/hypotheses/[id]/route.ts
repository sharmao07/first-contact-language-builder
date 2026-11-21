import { json, readToken, run } from "@/lib/api/handlers";
import { respondToHypothesis } from "@/lib/domain/discovery";
import { hypothesisResponseSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string; id: string }> }) {
  return run(async () => {
    const { code, id } = await context.params;
    const input = hypothesisResponseSchema.parse(await request.json());
    return json(await respondToHypothesis(code, readToken(request), id, input));
  });
}
