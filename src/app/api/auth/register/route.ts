import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { registerSchema } from "@/lib/auth/validation";
import { prisma } from "@/lib/db/prisma";
import { enforceRateLimit, registrationRateLimit } from "@/lib/http/rate-limit";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, registrationRateLimit);
  if (limited) return limited;
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "invalid_registration", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  const data = parsed.data;
  try {
    const user = await prisma.user.create({
      data: {
        collegeId: data.collegeId.toUpperCase(),
        name: data.name,
        academicYear: data.academicYear,
        email: data.email || null,
        passwordHash: await hash(data.password, 12),
        preference: { create: { locale: data.locale } },
        consents: { create: { kind: "analytics", version: "2026-08", status: "PENDING" } },
      },
      select: { id: true, collegeId: true },
    });
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return Response.json({ error: "college_id_or_email_exists" }, { status: 409 });
    throw error;
  }
}
