import { randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { adminForbidden, getAdmin } from "@/lib/admin/guard";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { captureError } from "@/lib/observability/logger";

/**
 * The ONLY privileged write surface. Reads never go through HTTP (admin pages query the
 * database in their server components), so this one route is the entire attack surface
 * for admin mutations -- which is why it is rate-limited, DB-role-gated on every call,
 * and writes an AuditLog row for everything it does.
 *
 * Password values are NEVER logged or stored in audit metadata; only the fact and shape
 * of the change ("generated" vs "custom") is.
 */

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SET_PASSWORD"),
    userId: z.string().uuid(),
    /** Re-authentication of the ADMIN performing the change -- always required. */
    adminPassword: z.string().min(1).max(128),
    /** Omit to have the server generate a strong password returned once in the response. */
    newPassword: z.string().min(8).max(128).optional(),
  }),
  z.object({
    action: z.literal("FORCE_LOGOUT"),
    userId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("SET_ROLE"),
    userId: z.string().uuid(),
    role: z.enum(["STUDENT", "ADMIN"]),
  }),
]);

const adminActionRateLimit = { name: "admin-actions", limit: 30, windowSeconds: 60 };

function generatePassword() {
  // 12 chars from a 62-symbol alphabet (~71 bits) -- strong enough to type once.
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function audit(
  adminId: string,
  action: string,
  targetUserId: string | null,
  meta?: Prisma.InputJsonValue,
) {
  try {
    await prisma.auditLog.create({
      data: { adminId, action, targetUserId, meta },
    });
  } catch (error) {
    // The action already happened; a failed trail entry must at least be visible somewhere.
    captureError("admin.audit", error, { adminId, action, targetUserId });
  }
}

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return adminForbidden();
  const limited = await enforceRateLimit(request, adminActionRateLimit, admin.id);
  if (limited) return limited;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const body = parsed.data;

  if (body.action === "SET_ROLE" && body.userId === admin.id)
    return Response.json({ error: "cannot_change_own_role" }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, name: true, collegeId: true, passwordHash: true, sessionVersion: true },
  });
  if (!target) return Response.json({ error: "not_found" }, { status: 404 });

  if (body.action === "SET_PASSWORD") {
    // Re-authenticate the admin with their own password for the most destructive action:
    // an unlocked laptop must not equal every student's account.
    const me = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { passwordHash: true },
    });
    if (!me || !(await compare(body.adminPassword, me.passwordHash))) {
      return Response.json({ error: "admin_password_invalid" }, { status: 403 });
    }
    const generated = body.newPassword ? undefined : generatePassword();
    const finalPassword = generated ?? body.newPassword!;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: target.id },
        data: {
          passwordHash: await hash(finalPassword, 12),
          sessionVersion: { increment: 1 },
        },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: target.id } }),
    ]);
    await audit(admin.id, "SET_PASSWORD", target.id, {
      collegeId: target.collegeId,
      generated: Boolean(generated),
      sessionsInvalidated: true,
    });
    return Response.json({ ok: true, generatedPassword: generated ?? null });
  }

  if (body.action === "FORCE_LOGOUT") {
    await prisma.user.update({
      where: { id: target.id },
      data: { sessionVersion: { increment: 1 } },
    });
    await audit(admin.id, "FORCE_LOGOUT", target.id, { collegeId: target.collegeId });
    return Response.json({ ok: true });
  }

  // SET_ROLE
  await prisma.user.update({ where: { id: target.id }, data: { role: body.role } });
  await audit(admin.id, "SET_ROLE", target.id, { role: body.role, collegeId: target.collegeId });
  return Response.json({ ok: true });
}
