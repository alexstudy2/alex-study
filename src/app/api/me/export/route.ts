import { prisma } from "@/lib/db/prisma";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { apiUser, unauthorized } from "@/lib/tasks/response";

const exportRateLimit = { name: "account-export", limit: 3, windowSeconds: 60 * 60 };

export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, exportRateLimit, user.id);
  if (limited) return limited;
  const data = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      collegeId: true,
      name: true,
      academicYear: true,
      email: true,
      timezone: true,
      weekStartsOn: true,
      aiNudgesEnabled: true,
      leaderboardVisible: true,
      profileVisibility: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      preference: true,
      consents: true,
      manualResetRequests: true,
      subjects: true,
      tasks: true,
      sessions: true,
      goals: true,
      roomMemberships: true,
      roomMessages: true,
      sentFriendRequests: true,
      receivedFriendRequests: true,
      createdChallenges: true,
      opponentChallenges: true,
      challengeProgress: true,
      badges: true,
      leaderboardEntries: true,
      insights: true,
      aiJobs: true,
      examPlans: true,
      serviceUsageLogs: true,
      taskDrafts: true,
      timerRuns: true,
      notifications: true,
      accountabilityPairsA: true,
      accountabilityPairsB: true,
      accountabilitySubjects: true,
      accountabilityRecipients: true,
      /* Portability completion (audit M11): forum-authored plans and saves, reactions the
         user left on peers' sessions, and the rooms/timers they hosted are their data too
         -- the earlier allowlist silently omitted all five. */
      studyPlans: true,
      studyPlanSaves: true,
      sessionReactions: true,
      ownedRooms: true,
      hostedTimerRuns: true,
    },
  });
  return new Response(
    JSON.stringify({ exportedAt: new Date().toISOString(), product: "Alex Study", data }, null, 2),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="alex-study-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "private, no-store",
      },
    },
  );
}
