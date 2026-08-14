import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { LobbyCreateForm } from "@/components/lobbies/lobby-create-form";
export default async function CreateLobbyPage() {
  const user = await requireUser();
  const locale = user.locale === "AR" ? "ar" : "en";
  return (
    <main className="lobby-form-shell">
      <Link className="back-link" href="/lobbies">
        ← {locale === "ar" ? "الغرف" : "Lobbies"}
      </Link>
      <p className="eyebrow">{locale === "ar" ? "غرفة جديدة" : "New room"}</p>
      <h1>{locale === "ar" ? "حدد إيقاع المجموعة." : "Set the group rhythm."}</h1>
      <LobbyCreateForm locale={locale} />
    </main>
  );
}
