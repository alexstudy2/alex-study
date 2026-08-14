import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";
import { subjectInputSchema } from "@/lib/tasks/validation";

export async function PATCH(request: Request, ctx: { params: Promise<{ subjectId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { subjectId } = await ctx.params;
  const parsed = subjectInputSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return invalid();
  const existing = await prisma.subject.findFirst({
    where: { id: subjectId, userId: user.id, archivedAt: null },
  });
  if (!existing) return notFound();
  const subject = await prisma.subject.update({
    where: { id: subjectId },
    data: {
      ...parsed.data,
      normalizedName: parsed.data.name?.toLocaleLowerCase().replace(/\s+/g, " "),
    },
  });
  return Response.json({ subject });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ subjectId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { subjectId } = await ctx.params;
  const result = await prisma.subject.updateMany({
    where: { id: subjectId, userId: user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (!result.count) return notFound();
  return Response.json({ ok: true });
}
