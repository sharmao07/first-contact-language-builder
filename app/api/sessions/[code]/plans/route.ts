import { json, readToken, run } from "@/lib/api/handlers";
import {
  approveExperimentPlan,
  editExperimentPlan,
  lockExperimentReply,
  recordExperimentOutcome,
  rejectExperimentPlan,
  replyToExperimentPlan,
  requestExperimentPlans,
} from "@/lib/domain/plans";
import { planActionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    const input = planActionSchema.parse(await request.json());
    const token = readToken(request);
    if (input.action === "request") return json(await requestExperimentPlans(code, token, input));
    if (input.action === "reject") return json(await rejectExperimentPlan(code, token, input.proposalId));
    if (input.action === "edit") return json(await editExperimentPlan(code, token, input));
    if (input.action === "approve") return json(await approveExperimentPlan(code, token, input));
    if (input.action === "reply") return json(await replyToExperimentPlan(code, token, input));
    if (input.action === "lock") return json(await lockExperimentReply(code, token, input.proposalId));
    return json(await recordExperimentOutcome(code, token, input));
  });
}
