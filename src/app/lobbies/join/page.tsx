import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { JoinButton } from "@/components/lobbies/join-button";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { DoorOpen } from "lucide-react";

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
    <PageShell size="narrow" dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={DoorOpen}
        backHref="/lobbies"
        backLabel={ar ? "الغرف" : "Lobbies"}
        isRtl={ar}
        eyebrow={ar ? "انضم إلى مجموعة" : "Join a group"}
        title={ar ? "اختر مساحة تناسب إيقاعك." : "Find a room that fits your rhythm."}
      />
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
    </PageShell>
  );
}
