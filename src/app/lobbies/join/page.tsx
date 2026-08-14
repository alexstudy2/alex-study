import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { JoinButton } from "@/components/lobbies/join-button";
export default async function JoinLobbyPage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string }>;
}) {
  const user = await requireUser();
  const { roomId } = await searchParams;
  const rooms = await prisma.room.findMany({
    where: { archivedAt: null, visibility: "PUBLIC", ...(roomId ? { id: roomId } : {}) },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });
  const ar = user.locale === "AR";
  return (
    <main className="lobby-form-shell">
      <Link className="back-link" href="/lobbies">
        ← {ar ? "الغرف" : "Lobbies"}
      </Link>
      <p className="eyebrow">{ar ? "انضم إلى مجموعة" : "Join a group"}</p>
      <h1>{ar ? "اختر مساحة تناسب إيقاعك." : "Find a room that fits your rhythm."}</h1>
      <div className="join-list">
        {rooms.map((room) => (
          <article key={room.id}>
            <div>
              <h2>{room.name}</h2>
              <p>{room.description}</p>
              <span>
                {room._count.members} / {room.maxMembers}
              </span>
            </div>
            <JoinButton roomId={room.id} label={ar ? "انضم" : "Join"} />
          </article>
        ))}
      </div>
    </main>
  );
}
