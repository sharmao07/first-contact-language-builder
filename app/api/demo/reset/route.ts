import { json, run } from "@/lib/api/handlers";
import { DEMO_SESSION_CODE } from "@/lib/constants";
import { assertDemoOperator } from "@/lib/demo/operator";
import { seedIllustrativeSession } from "@/lib/demo/illustrative";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => {
    assertDemoOperator(request);
    await seedIllustrativeSession();
    return json({ ok: true, code: DEMO_SESSION_CODE });
  });
}
