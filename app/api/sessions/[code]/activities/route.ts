import { json, readToken, run } from "@/lib/api/handlers";
import { generateActivities } from "@/lib/domain/checks";
import { activityGenerateSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    const body = await request.json().catch(() => ({}));
    return json(await generateActivities(code, readToken(request), activityGenerateSchema.parse(body)), 201);
  });
}
