import { run } from "@/lib/api/handlers";
import { exportResearch } from "@/lib/domain/research";
import { HttpError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return run(async () => {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "json";
    if (format !== "json" && format !== "csv" && format !== "md") {
      throw new HttpError(400, "Format must be json, csv, or md.");
    }
    const dataset = url.searchParams.get("dataset") ?? "concepts";
    const allowed = new Set(["concepts", "hypotheses", "evidence", "checks", "relationships"]);
    if (format === "csv" && !allowed.has(dataset)) {
      throw new HttpError(400, "CSV dataset must be concepts, hypotheses, evidence, checks, or relationships.");
    }
    const file = await exportResearch(format, url.searchParams.get("code"), dataset);
    return new Response(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  });
}
