import { prisma } from "@/lib/db/prisma";
import { cairoDayStart } from "@/lib/plan-forum/dates";
import { forumShelves } from "@/lib/plan-forum/queries";
import { planInputSchema } from "@/lib/plan-forum/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  return Response.json(await forumShelves(user));
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = planInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const { title, description, startDate, endDate } = parsed.data;
  const plan = await prisma.studyPlan.create({
    data: {
      authorId: user.id,
      title,
      description: description || null,
      startDate: cairoDayStart(startDate),
      endDate: cairoDayStart(endDate),
      // Stamped now, refreshed on share. See the note on StudyPlan.academicYear: the author's year
      // can change, and a plan shared with one class must not drift into the next.
      academicYear: user.academicYear,
    },
    select: { id: true },
  });
  return Response.json({ plan }, { status: 201 });
}
