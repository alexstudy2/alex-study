import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { LobbyRoom } from "@/components/lobbies/lobby-room";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Users } from "lucide-react";

export default async function LobbyDetailPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const user = await requireUser();
  const { roomId } = await params;
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });
  if (!membership) redirect(`/lobbies/join?roomId=${roomId}`);
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, academicYear: true } } },
        orderBy: { joinedAt: "asc" },
      },
      timerRuns: {
        where: { status: { in: ["RUNNING", "PAUSED"] } },
        orderBy: { createdAt: "desc" },
      },
      messages: {
        where: { deletedAt: null },
        include: { user: { select: { id: true, name: true, academicYear: true } } },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  });
  if (!room) notFound();
  const locale = user.locale === "AR" ? "ar" : "en";
  const ar = locale === "ar";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={Users}
        backHref="/lobbies"
        backLabel={ar ? "الغرف" : "Lobbies"}
        isRtl={ar}
        eyebrow={ar ? "غرفة تركيز" : "Focus room"}
        title={room.name}
        description={room.description ?? undefined}
      />
      <LobbyRoom
        initialRoom={room}
        role={membership.role}
        locale={locale}
        serverNow={new Date().toISOString()}
        currentUserId={user.id}
      />
    </PageShell>
  );
}
