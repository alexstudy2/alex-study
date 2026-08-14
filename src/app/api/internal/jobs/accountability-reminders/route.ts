import { runAccountabilityReminders } from "@/lib/accountability/reminders";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron";
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await runAccountabilityReminders());
}
