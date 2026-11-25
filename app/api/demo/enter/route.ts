import { demoEntryTtlMs, issueCredential } from "@/lib/access/credentials";
import { json, run } from "@/lib/api/handlers";
import { DEMO_SESSION_CODE } from "@/lib/constants";
import { prisma } from "@/lib/database/prisma";
import { assertDemoOperator } from "@/lib/demo/operator";
import { seedIllustrativeSession } from "@/lib/demo/illustrative";
import { HttpError } from "@/lib/http";
import { demoEnterSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => {
    assertDemoOperator(request);
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
    if (!participant) throw new HttpError(404, "That demo seat is missing.");
    await prisma.participant.update({
      where: { id: participant.id },
      data: { leftAt: null, lastSeenAt: new Date() },
    });
    const issued = await issueCredential(participant.id, "demo", demoEntryTtlMs(), { replaceStoredToken: false });
    return json({
      code: session.code,
      token: issued.token,
      expiresAt: issued.expiresAt.toISOString(),
      participantId: participant.id,
      role: participant.role,
      displayName: participant.displayName,
      illustrative: true,
      purpose: "demo",
    });
  });
}
