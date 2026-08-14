import { prisma } from "@/lib/db/prisma";
import { generateDailyTip } from "@/lib/insights/service";
import { apiUser, unauthorized } from "@/lib/tasks/response";
import { enforceRateLimit, generationRateLimit } from "@/lib/http/rate-limit";

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, generationRateLimit, user.id);
  if (limited) return limited;
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { aiNudgesEnabled: true, preference: { select: { locale: true } } },
  });
  if (!profile?.aiNudgesEnabled) return Response.json({ error: "ai_disabled" }, { status: 403 });
  const result = await generateDailyTip(user.id, profile.preference?.locale === "AR" ? "ar" : "en");
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(
    { insight: result.insight, cached: result.cached },
    { status: result.cached ? 200 : 201 },
  );
}
