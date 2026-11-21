import { json, run } from "@/lib/api/handlers";
import { joinSession } from "@/lib/domain/session";
import { joinSessionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => json(await joinSession(joinSessionSchema.parse(await request.json()))));
}
