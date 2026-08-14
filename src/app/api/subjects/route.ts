import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { subjectInputSchema } from "@/lib/tasks/validation";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  return Response.json({
    subjects: await prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { name: "asc" },
    }),
  });
}
export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = subjectInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  try {
    const subject = await prisma.subject.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        normalizedName: parsed.data.name.toLocaleLowerCase().replace(/\s+/g, " "),
        colorToken: parsed.data.colorToken,
      },
    });
    return Response.json({ subject }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return Response.json({ error: "subject_exists" }, { status: 409 });
    throw error;
  }
}
