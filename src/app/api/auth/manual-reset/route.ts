import { manualResetSchema } from "@/lib/auth/validation";
import { prisma } from "@/lib/db/prisma";
import { readRequestBody } from "@/lib/http/body";
import { enforceRateLimit, recoveryRateLimit } from "@/lib/http/rate-limit";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, recoveryRateLimit);
  if (limited) return limited;
  const parsed = manualResetSchema.safeParse(await readRequestBody(request).catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const user = await prisma.user.findFirst({
    where: { collegeId: parsed.data.collegeId.toUpperCase() },
  });
  if (user)
    await prisma.manualPasswordResetRequest.create({
      data: { userId: user.id, details: parsed.data.details },
    });
  return Response.json({ ok: true }, { status: 201 });
}
