import { requireUser } from "@/lib/auth/session";
import { LobbyCreateForm } from "@/components/lobbies/lobby-create-form";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Plus } from "lucide-react";

export default async function CreateLobbyPage() {
  const user = await requireUser();
  const locale = user.locale === "AR" ? "ar" : "en";
  const ar = locale === "ar";

  return (
    <PageShell size="narrow" dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={Plus}
        backHref="/lobbies"
        backLabel={ar ? "الغرف" : "Lobbies"}
        isRtl={ar}
        eyebrow={ar ? "غرفة جديدة" : "New room"}
        title={ar ? "حدد إيقاع المجموعة." : "Set the group rhythm."}
      />
      <LobbyCreateForm locale={locale} />
    </PageShell>
  );
}
