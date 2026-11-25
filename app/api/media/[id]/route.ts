import { resolvePresented } from "@/lib/access/credentials";
import { json, readToken, run } from "@/lib/api/handlers";
import { prisma } from "@/lib/database/prisma";
import { HttpError } from "@/lib/http";
import { mediaSignatureValid } from "@/lib/media/sign";
import { readUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { id } = await context.params;
    const evidence = await prisma.evidence.findFirst({ where: { id, deletedAt: null } });
    if (!evidence?.storagePath) throw new HttpError(404, "That file is not available.");
    const url = new URL(request.url);
    const signed = mediaSignatureValid(id, url.searchParams.get("exp"), url.searchParams.get("sig"));
    if (!signed) {
      const resolved = await resolvePresented(readToken(request));
      const allowed = Boolean(resolved && !resolved.failure && resolved.participant.sessionId === evidence.sessionId);
      if (!allowed) throw new HttpError(404, "That file is not available.");
    }
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
