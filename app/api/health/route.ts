import { getAIPublicStatus } from "@/lib/ai/config";
import { json, run } from "@/lib/api/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return run(async () => json({ ok: true, ...getAIPublicStatus() }));
}
