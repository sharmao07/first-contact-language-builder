import { json, readToken, run } from "@/lib/api/handlers";
import { addParticipantHypothesis } from "@/lib/domain/discovery";
import { participantHypothesisSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    const input = participantHypothesisSchema.parse(await request.json());
    return json(await addParticipantHypothesis(code, readToken(request), input), 201);
  });
}
