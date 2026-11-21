import { json, run } from "@/lib/api/handlers";
import { rejoinSession } from "@/lib/domain/session";
import { rejoinSessionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => json(await rejoinSession(rejoinSessionSchema.parse(await request.json()))));
}
