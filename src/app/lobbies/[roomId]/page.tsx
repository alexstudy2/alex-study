import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { LobbyRoom } from "@/components/lobbies/lobby-room";
export default async function LobbyPage({ params }: { params: Promise<{ roomId: string }> }) {
  const user = await requireUser();
  const { roomId } = await params;
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });
  if (!membership) redirect(`/lobbies/join?roomId=${roomId}`);
  const room = await prisma.room.findFirst({
    where: { id: roomId, archivedAt: null },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, academicYear: true } } },
        orderBy: { joinedAt: "asc" },
      },
      timerRuns: {
        where: { status: { in: ["RUNNING", "PAUSED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
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
  return (
    <main className="lobby-detail-shell">
      <header className="room-header">
        <div>
          <Link className="back-link" href="/lobbies">
            ← {locale === "ar" ? "الغرف" : "Lobbies"}
          </Link>
          <p className="eyebrow">{locale === "ar" ? "غرفة تركيز" : "Focus room"}</p>
          <h1>{room.name}</h1>
          <p>{room.description}</p>
        </div>
      </header>
      <LobbyRoom
        initialRoom={room}
        role={membership.role}
        locale={locale}
        serverNow={new Date().toISOString()}
      />
    </main>
  );
}
