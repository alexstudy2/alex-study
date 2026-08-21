import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { relationshipMarks } from "@/lib/social/queries";
import { searchQuerySchema } from "@/lib/social/validation";
import { enforceRateLimit, searchRateLimit } from "@/lib/http/rate-limit";

export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, searchRateLimit, user.id);
  if (limited) return limited;
  const parsed = searchQuerySchema.safeParse(new URL(request.url).searchParams.get("q") ?? "");
  if (!parsed.success) return invalid();
  const users = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      profileVisibility: "COLLEGE_ONLY",
      OR: [
        { name: { contains: parsed.data, mode: "insensitive" } },
        { collegeId: { contains: parsed.data, mode: "insensitive" } },
      ],
      AND: [
        { sentFriendRequests: { none: { addresseeId: user.id, status: "BLOCKED" } } },
        { receivedFriendRequests: { none: { requesterId: user.id, status: "BLOCKED" } } },
      ],
    },
    select: { id: true, name: true, academicYear: true, imageUrl: true },
    take: 12,
    orderBy: { name: "asc" },
  });
  /* Results used to arrive with no idea of who was already a friend, so every row offered an Add
     button and existing friends answered it with the generic "could not be completed". The client
     can now label the row instead of firing a request that is known to fail. */
  const marks = await relationshipMarks(
    user.id,
    users.map((match) => match.id),
  );
  return Response.json({
    users: users.map((match) => ({ ...match, relationship: marks.get(match.id) ?? "none" })),
  });
}
