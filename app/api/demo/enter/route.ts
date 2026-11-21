import { json, run } from "@/lib/api/handlers";
import { DEMO_SESSION_CODE } from "@/lib/constants";
import { prisma } from "@/lib/database/prisma";
import { seedIllustrativeSession } from "@/lib/demo/illustrative";
import { HttpError } from "@/lib/http";
import { demoEnterSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => {
    const input = demoEnterSchema.parse(await request.json());
    let session = await prisma.discoverySession.findUnique({
      where: { code: DEMO_SESSION_CODE },
      include: { participants: true },
    });
    if (!session) {
      await seedIllustrativeSession();
      session = await prisma.discoverySession.findUnique({
        where: { code: DEMO_SESSION_CODE },
        include: { participants: true },
      });
    }
    if (!session?.isDemo) throw new HttpError(404, "The illustrative session is unavailable.");
    const participant = session.participants.find((item) => item.role === input.role);
    if (!participant) throw new HttpError(404, "That demo seat is missing. Reset the illustrative session.");
    await prisma.participant.update({
      where: { id: participant.id },
      data: { leftAt: null, lastSeenAt: new Date() },
    });
    return json({
      code: session.code,
      token: participant.token,
      participantId: participant.id,
      role: participant.role,
      displayName: participant.displayName,
      illustrative: true,
    });
  });
}
