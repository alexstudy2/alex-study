import { runChallengeLifecycle } from "@/lib/challenges/engine";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron";
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await runChallengeLifecycle());
}

export const GET = POST;

