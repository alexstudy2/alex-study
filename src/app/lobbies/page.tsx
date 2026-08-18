import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Plus, DoorOpen, Lock, Globe, ArrowRight, ArrowLeft } from "lucide-react";

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
  const NavArrow = ar ? ArrowLeft : ArrowRight;

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={Users}
        eyebrow={ar ? "غرف التركيز" : "Focus lobbies"}
        title={ar ? "ادرس مع آخرين، دون ضوضاء." : "Study together, without the noise."}
        description={
          ar
            ? "غرف دراسية افتراضية للتركيز المشترك والهدوء بين زملاء الدفعة."
            : "Virtual study rooms for shared silent focus alongside medical peers."
        }
        actions={
          <div className="page-header-actions">
            <Button
              href="/lobbies/join"
              variant="secondary"
              size="sm"
              leftIcon={<DoorOpen className="w-4 h-4" />}
            >
              {ar ? "انضم برمز" : "Join with code"}
            </Button>
            <Button
              href="/lobbies/create"
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {ar ? "غرفة جديدة" : "New room"}
            </Button>
          </div>
        }
      />

      {rooms.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="w-6 h-6" />}
          title={ar ? "لا توجد غرف نشطة حاليًا" : "No active lobbies yet"}
          description={
            ar
              ? "أنشئ غرفة دراسية وشارك الرمز مع زملائك للمذاكرة الجماعية."
              : "Create a room and share the invite code with classmates."
          }
          actionLabel={ar ? "إنشاء غرفة" : "Create room"}
          actionHref="/lobbies/create"
        />
      ) : (
        <div className="room-grid">
          {rooms.map((room) => {
            const isMember = room.members.length > 0;
            const roomHref = isMember
              ? `/lobbies/${room.id}`
              : `/lobbies/join?roomId=${room.id}`;
            return (
              <article key={room.id} className="room-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-sunken border border-line">
                    {room.visibility === "PUBLIC" ? (
                      <Globe className="w-3 h-3 text-primary" />
                    ) : (
                      <Lock className="w-3 h-3 text-muted" />
                    )}
                    {room.visibility}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-muted">
                    <Users className="w-3.5 h-3.5" />
                    {room._count.members} / {room.maxMembers}
                  </span>
                </div>
                <h2>{room.name}</h2>
                <p>{room.description ?? (ar ? "غرفة تركيز هادئة." : "A quiet focus room.")}</p>
                <Link
                  href={roomHref}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary-strong transition-colors mt-auto"
                >
                  <span>
                    {isMember
                      ? ar
                        ? "ادخل الغرفة"
                        : "Enter room"
                      : ar
                      ? "انضم الآن"
                      : "Join now"}
                  </span>
                  <NavArrow className="w-4 h-4" />
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
