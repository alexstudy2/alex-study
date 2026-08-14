import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { readRequestBody } from "@/lib/http/body";

const schema = z.object({ accepted: z.union([z.boolean(), z.enum(["true", "false"])]).transform((value) => value === true || value === "true") });
async function updateConsent(request: Request) {
  const session = await getSession();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await readRequestBody(request).catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await prisma.userConsent.upsert({ where: { userId_kind_version: { userId: session.user.id, kind: "analytics", version: "2026-08" } }, create: { userId: session.user.id, kind: "analytics", version: "2026-08", status: parsed.data.accepted ? "ACCEPTED" : "DECLINED", decidedAt: new Date() }, update: { status: parsed.data.accepted ? "ACCEPTED" : "DECLINED", decidedAt: new Date() } });
  return Response.json({ ok: true });
}
export const PATCH = updateConsent;
export const POST = updateConsent;
