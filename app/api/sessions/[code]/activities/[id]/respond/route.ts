import { json, readToken, run } from "@/lib/api/handlers";
import { respondToActivity } from "@/lib/domain/checks";
import { activityResponseSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string; id: string }> }) {
  return run(async () => {
    const { code, id } = await context.params;
    return json(await respondToActivity(code, readToken(request), id, activityResponseSchema.parse(await request.json())));
  });
}
