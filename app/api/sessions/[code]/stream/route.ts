import { readToken } from "@/lib/api/handlers";
import { syncSession } from "@/lib/domain/serialize";
import { HttpError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const token = readToken(request);
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* The client already hung up. */
        }
      };
      request.signal.addEventListener("abort", close);
      let since = Number(new URL(request.url).searchParams.get("revision") ?? "0");
      if (!Number.isFinite(since)) since = 0;

      const tick = async () => {
        if (closed) return;
        try {
          const payload = await syncSession(code, token, since);
          if (payload.state) since = payload.revision;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch (error) {
          const message = error instanceof HttpError ? error.message : "The session stream stopped.";
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`));
          close();
        }
      };

      await tick();
      timer = setInterval(() => void tick(), 1200);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
