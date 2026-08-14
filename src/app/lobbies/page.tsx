import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export default async function LobbiesPage() {
  const user = await requireUser();
  const rooms = await prisma.room.findMany({
    where: {
      archivedAt: null,
      OR: [{ visibility: "PUBLIC" }, { members: { some: { userId: user.id } } }],
    },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId: user.id }, select: { role: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const ar = user.locale === "AR";
  return (
    <main className="lobbies-shell" dir={ar ? "rtl" : "ltr"}>
      <header className="lobbies-header">
        <div>
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">{ar ? "غرف التركيز" : "Focus lobbies"}</p>
          <h1>{ar ? "ادرس مع آخرين، دون ضوضاء." : "Study together, without the noise."}</h1>
        </div>
        <div className="lobby-header-actions">
          <Link className="secondary-button" href="/lobbies/join">
            {ar ? "انضم" : "Join"}
          </Link>
          <Link className="primary-button" href="/lobbies/create">
            {ar ? "غرفة جديدة" : "New room"}
          </Link>
        </div>
      </header>
      <div className="room-grid">
        {rooms.map((room) => (
          <article key={room.id}>
            <div>
              <span>{room.visibility}</span>
              <strong>
                {room._count.members} / {room.maxMembers}
              </strong>
            </div>
            <h2>{room.name}</h2>
            <p>{room.description ?? (ar ? "غرفة تركيز هادئة." : "A quiet focus room.")}</p>
            <Link
              href={room.members.length ? `/lobbies/${room.id}` : `/lobbies/join?roomId=${room.id}`}
            >
              {room.members.length
                ? ar
                  ? "ادخل الغرفة"
                  : "Enter room"
                : ar
                  ? "انضم الآن"
                  : "Join now"}
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
