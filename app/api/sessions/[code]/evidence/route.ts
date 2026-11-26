import { json, readToken, run } from "@/lib/api/handlers";
import { addEvidence } from "@/lib/domain/discovery";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { evidenceFieldsSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    const token = readToken(request);
    const limit = await enforceRateLimit({ action: "evidence_upload", request, code, token });
    const form = await request.formData();
    const action = String(form.get("actionCategory") ?? "");
    const conceptId = String(form.get("conceptId") ?? "");
    const parent = String(form.get("parentEvidenceId") ?? "");
    const duration = Number(form.get("durationMs") ?? "");
    const fields = evidenceFieldsSchema.parse({
      type: form.get("type"),
      description: form.get("description") ?? "",
      notes: form.get("notes") ?? "",
      actionCategory: action || null,
      conceptId: conceptId || null,
      stance: form.get("stance") || "observation",
      consentToAnalyze: form.get("consentToAnalyze") === "yes",
      durationMs: Number.isFinite(duration) && duration > 0 ? duration : null,
      qualityNote: form.get("qualityNote") ?? "",
      annotation: form.get("annotation") ?? "",
      parentEvidenceId: parent || null,
      gestureDirection: form.get("gestureDirection") ?? "",
      gestureRepetition: form.get("gestureRepetition") ?? "",
      gestureBody: form.get("gestureBody") ?? "",
    });
    const file = form.get("file");
    let uploaded: { bytes: Buffer; mimeType: string; fileName: string } | null = null;
    if (file instanceof File && file.size > 0) {
      uploaded = {
        bytes: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type,
        fileName: file.name,
      };
    }
    return json(await addEvidence({ code, token, fields, file: uploaded }), 201, {
      "X-RateLimit-Limit": String(limit.limit),
      "X-RateLimit-Remaining": String(limit.remaining),
      "X-RateLimit-Reset": String(limit.resetAtSeconds),
    });
  });
}
