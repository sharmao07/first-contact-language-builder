import { json, readToken, run } from "@/lib/api/handlers";
import { applyCommunityAction } from "@/lib/domain/community";
import { communityActionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string }> };

export function POST(request: Request, context: Context) {
  return run(async () => {
    const { code } = await context.params;
    const input = communityActionSchema.parse(await request.json());
    return json(await applyCommunityAction(code, readToken(request), input));
  });
}
