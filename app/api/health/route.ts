import { buildHealthReport, healthHttpStatus } from "@/lib/health/report";
import { json, run } from "@/lib/api/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return run(async () => {
    const report = await buildHealthReport();
    return json(report, healthHttpStatus(report));
  });
}
