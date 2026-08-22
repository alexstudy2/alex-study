import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/prisma";

export const getSession = () => getServerSession(authOptions);
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  return session.user;
}
export async function requireAdmin() {
  const user = await requireUser();
  /* Role comes from the database, not the JWT: the token freezes role at sign-in, so a
     demoted admin would otherwise keep the claim for up to 30 days (audit L6). */
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (row?.role !== "ADMIN") redirect("/dashboard");
  return user;
}
