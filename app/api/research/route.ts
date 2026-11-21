import { json, run } from "@/lib/api/handlers";
import { researchSnapshot } from "@/lib/domain/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return run(async () => {
    const code = new URL(request.url).searchParams.get("code");
    return json(await researchSnapshot(code));
  });
}
