import { json, readToken, run } from "@/lib/api/handlers";
import { impactForSession, impactMarkdown } from "@/lib/domain/community";
import { getSessionByCode } from "@/lib/domain/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string }> };

export function GET(request: Request, context: Context) {
  return run(async () => {
    const { code } = await context.params;
    const token = readToken(request);
    const summary = await impactForSession(code, token);
    const format = new URL(request.url).searchParams.get("format");
    if (format === "md") {
      const session = await getSessionByCode(code);
      return new Response(impactMarkdown(code, session.name, summary), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${code}-impact.md"`,
        },
      });
    }
    return json(summary);
  });
}
