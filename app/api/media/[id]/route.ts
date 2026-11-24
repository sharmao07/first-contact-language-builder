import { prisma } from "@/lib/database/prisma";
import { getSessionByCode } from "@/lib/domain/common";
import { HttpError } from "@/lib/http";
import { readUpload } from "@/lib/storage";
import { json, run } from "@/lib/api/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { id } = await context.params;
    const code = new URL(request.url).searchParams.get("code") ?? "";
    const session = await getSessionByCode(code);
    const evidence = await prisma.evidence.findFirst({ where: { id, sessionId: session.id, deletedAt: null } });
    if (!evidence?.storagePath) throw new HttpError(404, "That file is not available.");
    const bytes = await readUpload(evidence.storagePath);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": evidence.mimeType || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
      },
    });
  });
}

export function OPTIONS() {
  return json({ ok: true });
}
