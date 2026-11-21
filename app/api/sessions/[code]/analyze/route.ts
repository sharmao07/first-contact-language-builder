import { json, readToken, run } from "@/lib/api/handlers";
import { analyzeEvidence } from "@/lib/domain/discovery";
import { analyzeSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    const input = analyzeSchema.parse(await request.json());
    return json(await analyzeEvidence(code, readToken(request), input.evidenceId));
  });
}
