import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
export default async function LobbySettingsPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const user = await requireUser();
  const { roomId } = await params;
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
    include: { room: true },
  });
  if (!member || member.role === "MEMBER") redirect(`/lobbies/${roomId}`);
  const ar = user.locale === "AR";
  return (
    <main className="lobby-form-shell">
      <Link className="back-link" href={`/lobbies/${roomId}`}>
        ← {ar ? "الغرفة" : "Room"}
      </Link>
      <p className="eyebrow">{ar ? "إعدادات الغرفة" : "Room settings"}</p>
      <h1>{member.room.name}</h1>
      <dl className="detail-metrics">
        <div>
          <dt>{ar ? "الظهور" : "Visibility"}</dt>
          <dd>{member.room.visibility}</dd>
        </div>
        <div>
          <dt>{ar ? "السعة" : "Capacity"}</dt>
          <dd>{member.room.maxMembers}</dd>
        </div>
        <div>
          <dt>{ar ? "الدردشة" : "Chat"}</dt>
          <dd>{member.room.chatEnabled ? "ON" : "OFF"}</dd>
        </div>
        <div>
          <dt>{ar ? "دورك" : "Your role"}</dt>
          <dd>{member.role}</dd>
        </div>
      </dl>
      <p className="muted-copy">
        {ar
          ? "تعديل الأدوار والأرشفة سيُضاف مع أدوات الإدارة الاجتماعية الموسعة."
          : "Role editing and archival will be completed with the expanded social moderation tools."}
      </p>
    </main>
  );
}
