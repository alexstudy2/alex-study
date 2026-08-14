import { prisma } from "@/lib/db/prisma";
import { sessionInclude } from "@/lib/sessions/queries";
import { apiUser, notFound, unauthorized } from "@/lib/sessions/response";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { sessionId } = await context.params;
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: sessionInclude,
  });
  return session ? Response.json({ session }) : notFound();
}
