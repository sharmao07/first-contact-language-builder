import { json, readToken, run } from "@/lib/api/handlers";
import { createNote } from "@/lib/domain/checks";
import { noteSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    return json(await createNote(code, readToken(request), noteSchema.parse(await request.json())), 201);
  });
}
