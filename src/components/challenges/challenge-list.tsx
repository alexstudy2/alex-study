"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Flag,
  Medal,
  Plus,
  Swords,
  Target,
  TrendingUp,
} from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import type { BadgeAward, Challenge } from "@/components/challenges/types";
import {
  badgeCopy,
  challengeOpponent,
  challengeTypeLabel,
  challengeUnit,
  formatDate,
  resolutionLabel,
  statusLabel,
} from "@/components/challenges/format";

type Stats = {
  active: number;
  completed: number;
  wins: number;
  draws: number;
  targetReached: number;
  winRate: number;
  badges: BadgeAward[];
};

function renderBadgeIcon(icon: string) {
  switch (icon) {
    case "medal":
      return <Medal className="w-5 h-5 text-accent" />;
    case "target":
      return <Target className="w-5 h-5 text-primary" />;
    case "trend-up":
      return <TrendingUp className="w-5 h-5 text-success" />;
    default:
      return <Flag className="w-5 h-5 text-warning" />;
  }
}

export function ChallengeList({
  userId,
  locale,
  initialChallenges,
  stats,
}: {
  userId: string;
  locale: "en" | "ar";
  initialChallenges: Challenge[];
  stats: Stats;
}) {
  const ar = locale === "ar";
  const [filter, setFilter] = useState<"current" | "history">("current");
  const current = ["PENDING", "SCHEDULED", "ACTIVE"];
  const challenges = initialChallenges.filter((challenge) =>
    filter === "current" ? current.includes(challenge.status) : !current.includes(challenge.status)
  );

  const NavArrow = ar ? ArrowLeft : ArrowRight;

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={Swords}
        eyebrow={ar ? "تحديات فردية" : "One-to-one challenges"}
        title={ar ? "تنافس على عادات حقيقية." : "Compete on habits that hold up."}
        description={
          ar
            ? "تحديات ودية مع زملاء الكلية."
            : "Friendly study challenges with classmates."}
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/leaderboard">
              {ar ? "لوحة المتصدرين" : "Leaderboard"}
            </Link>
            <Button
              href="/challenges/new"
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {ar ? "تحدٍ جديد" : "New challenge"}
            </Button>
          </div>
        }
      />

      <section
        className="challenge-stats"
        aria-label={ar ? "إحصاءات التحدي" : "Challenge statistics"}
      >
        <article>
          <span>{ar ? "الحالية" : "Current"}</span>
          <strong>{stats.active}</strong>
        </article>
        <article>
          <span>{ar ? "المكتملة" : "Completed"}</span>
          <strong>{stats.completed}</strong>
        </article>
        <article>
          <span>{ar ? "معدل التقدم" : "Leading rate"}</span>
          <strong>{stats.winRate}%</strong>
        </article>
      </section>

      <div className="challenge-layout">
        <section className="challenge-main-panel">
          <div className="challenge-toolbar">
            <div role="tablist" aria-label={ar ? "تصفية التحديات" : "Challenge filter"}>
              <button
                role="tab"
                aria-selected={filter === "current"}
                onClick={() => setFilter("current")}
              >
                {ar ? "الحالية" : "Current"}
              </button>
              <button
                role="tab"
                aria-selected={filter === "history"}
                onClick={() => setFilter("history")}
              >
                {ar ? "السجل" : "History"}
              </button>
            </div>
            <p aria-live="polite">
              {ar
                ? `${challenges.length} تحديات`
                : `${challenges.length} challenge${challenges.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="challenge-list">
            {challenges.length ? (
              challenges.map((challenge) => {
                const opponent = challengeOpponent(challenge, userId);
                const myProgress = challenge.progress.find((item) => item.userId === userId);
                const theirProgress = challenge.progress.find(
                  (item) => item.userId === opponent.id
                );
                const resultHref = ["COMPLETED", "EXPIRED", "DECLINED", "CANCELLED"].includes(
                  challenge.status
                )
                  ? `/challenges/${challenge.id}/result`
                  : `/challenges/${challenge.id}`;
                return (
                  <article className="challenge-list-card" key={challenge.id}>
                    <div className="challenge-list-topline">
                      <span className="challenge-status" data-status={challenge.status}>
                        {statusLabel(challenge.status, locale)}
                      </span>
                      <time>{formatDate(challenge.endsAt, locale)}</time>
                    </div>
                    <div className="challenge-card-copy">
                      <p>{challengeTypeLabel(challenge.type, locale)}</p>
                      <h2>{ar ? `أنت و${opponent.name}` : `You and ${opponent.name}`}</h2>
                      <span>
                        {challenge.subjectLabel ? `${challenge.subjectLabel} · ` : ""}
                        {challenge.targetValue}{" "}
                        {challengeUnit(challenge.type, challenge.targetValue, locale)} ·{" "}
                        {resolutionLabel(challenge.resolutionType, locale)}
                      </span>
                    </div>
                    <div className="challenge-score-pair" aria-label={ar ? "التقدم" : "Progress"}>
                      <strong>{myProgress?.currentValue ?? 0}</strong>
                      <span>{ar ? "مقابل" : "vs"}</span>
                      <strong>{theirProgress?.currentValue ?? 0}</strong>
                    </div>
                    <Link className="challenge-card-link" href={resultHref}>
                      <span>
                        {filter === "history"
                          ? ar
                            ? "عرض النتيجة"
                            : "View result"
                          : ar
                          ? "فتح التحدي"
                          : "Open challenge"}
                      </span>
                      <NavArrow className="w-4 h-4 inline-block" />
                    </Link>
                  </article>
                );
              })
            ) : (
              <div className="challenge-empty">
                <p className="eyebrow">{ar ? "مساحة هادئة" : "Quiet slate"}</p>
                <h2>{ar ? "لا توجد تحديات هنا بعد." : "No challenges here yet."}</h2>
                <p>
                  {ar
                    ? "ابدأ بهدف واضح مع صديق."
                    : "Start with a clear goal and a friend."}
                </p>
                <Button
                  href="/challenges/new"
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  {ar ? "إنشاء تحدٍ" : "Create a challenge"}
                </Button>
              </div>
            )}
          </div>
        </section>

        <aside className="challenge-side-panel">
          <section>
            <div className="panel-heading">
              <h2 className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-accent" />
                <span>{ar ? "الشارات" : "Badges"}</span>
              </h2>
              <span className="font-semibold text-sm">{stats.badges.length}</span>
            </div>
            <div className="badge-list">
              {stats.badges.length ? (
                stats.badges.slice(0, 6).map((award) => (
                  <article key={award.id} className="flex items-center gap-2">
                    <span aria-hidden="true">{renderBadgeIcon(award.badge.iconKey)}</span>
                    <div>
                      <strong>{badgeCopy(award.badge.key, locale, award.badge).name}</strong>
                      <small>{badgeCopy(award.badge.key, locale, award.badge).description}</small>
                    </div>
                  </article>
                ))
              ) : (
                <p className="muted-copy">
                  {ar
                    ? "تظهر الشارات بعد إكمال تحدٍ مقبول."
                    : "Badges appear after an accepted challenge is completed."}
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
