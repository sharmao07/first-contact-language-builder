import { json, readToken, run } from "@/lib/api/handlers";
import { respondToExperiment } from "@/lib/domain/checks";
import { experimentResponseSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string; id: string }> }) {
  return run(async () => {
    const { code, id } = await context.params;
    return json(await respondToExperiment(code, readToken(request), id, experimentResponseSchema.parse(await request.json())));
  });
}
