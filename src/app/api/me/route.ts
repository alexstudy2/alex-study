import { compare } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { deleteAccountSchema, profileSettingsSchema } from "@/lib/settings/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";

const accountRateLimit = { name: "account-sensitive", limit: 5, windowSeconds: 60 * 60 };

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      collegeId: true,
      name: true,
      academicYear: true,
      email: true,
      timezone: true,
      aiNudgesEnabled: true,
      leaderboardVisible: true,
      profileVisibility: true,
      preference: true,
    },
  });
  return Response.json({ profile });
}

export async function PATCH(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = profileSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const { locale, email, ...profile } = parsed.data;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const account = await tx.user.update({
        where: { id: user.id },
        data: { ...profile, ...(email === undefined ? {} : { email: email || null }) },
        select: { id: true, name: true, academicYear: true, email: true, collegeId: true },
      });
      const preference = locale
        ? await tx.userPreference.upsert({
            where: { userId: user.id },
            update: { locale },
            create: { userId: user.id, locale },
          })
        : null;
      return { account, preference };
    });
    const response = NextResponse.json(updated);
    if (locale) {
      response.cookies.set("alex-study-locale", locale.toLowerCase(), {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "email_in_use" }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, accountRateLimit, user.id);
  if (limited) return limited;
  const parsed = deleteAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record || !(await compare(parsed.data.password, record.passwordHash))) {
    return Response.json({ error: "invalid_password" }, { status: 403 });
  }
  await prisma.user.delete({ where: { id: user.id } });
  return Response.json({ deleted: true });
}
