import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicChallengeCard } from "@/components/challenges/public-challenge-card";
import { publicChallengeByToken } from "@/lib/challenges/service";

export default async function SharedChallengePage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const [challenge, requestHeaders] = await Promise.all([
    publicChallengeByToken(shareToken),
    headers(),
  ]);
  if (!challenge) notFound();
  const locale = requestHeaders.get("accept-language")?.toLowerCase().startsWith("ar")
    ? "ar"
    : "en";
  return <PublicChallengeCard challenge={challenge} locale={locale} />;
}
