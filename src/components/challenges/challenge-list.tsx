"use client";

import Link from "next/link";
import { useState } from "react";
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
    filter === "current" ? current.includes(challenge.status) : !current.includes(challenge.status),
  );

  return (
    <main className="challenge-shell" dir={ar ? "rtl" : "ltr"}>
      <header className="challenge-header">
        <div>
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">{ar ? "تحديات فردية" : "One-to-one challenges"}</p>
          <h1>{ar ? "تنافس على عادات حقيقية." : "Compete on habits that hold up."}</h1>
          <p>
            {ar
              ? "يُحتسب النشاط المؤهل فقط، وتظل التعديلات ظاهرة، ويمكنك اختيار طريقة الحسم."
              : "Only eligible activity counts, corrections stay visible, and you choose how the result is decided."}
          </p>
        </div>
        <nav className="challenge-header-actions" aria-label={ar ? "التحديات" : "Challenges"}>
          <Link className="secondary-button" href="/leaderboard">
            {ar ? "لوحة المتصدرين" : "Leaderboard"}
          </Link>
          <Link className="primary-button" href="/challenges/new">
            {ar ? "تحدٍ جديد" : "New challenge"}
          </Link>
        </nav>
      </header>

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
          <span>{ar ? "النتائج المتقدمة" : "Leading finishes"}</span>
          <strong>{stats.wins}</strong>
        </article>
        <article>
          <span>{ar ? "التعادلات" : "Draws"}</span>
          <strong>{stats.draws}</strong>
        </article>
        <article>
          <span>{ar ? "الوصول للهدف" : "Targets reached"}</span>
          <strong>{stats.targetReached}</strong>
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
                  (item) => item.userId === opponent.id,
                );
                const resultHref = ["COMPLETED", "EXPIRED", "DECLINED", "CANCELLED"].includes(
                  challenge.status,
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
                      {filter === "history"
                        ? ar
                          ? "عرض النتيجة"
                          : "View result"
                        : ar
                          ? "فتح التحدي"
                          : "Open challenge"}
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
                    ? "ابدأ بهدف واضح مع صديق، دون احتساب المهام القصيرة أو الجلسات اليدوية."
                    : "Start with a clear goal and a friend. Short tasks and manual sessions never count."}
                </p>
                <Link className="primary-button" href="/challenges/new">
                  {ar ? "إنشاء تحدٍ" : "Create a challenge"}
                </Link>
              </div>
            )}
          </div>
        </section>

        <aside className="challenge-side-panel">
          <section>
            <p className="eyebrow">{ar ? "قواعد عادلة" : "Fair-play rules"}</p>
            <h2>{ar ? "ما الذي يُحتسب؟" : "What counts?"}</h2>
            <ul>
              <li>
                {ar ? "المهمة لا تقل عن 10 دقائق." : "Tasks must be estimated at 10+ minutes."}
              </li>
              <li>
                {ar
                  ? "مهمة واحدة مؤهلة كل خمس دقائق."
                  : "At most one eligible task every five minutes."}
              </li>
              <li>
                {ar
                  ? "الجلسات اليدوية لا تدخل المنافسة."
                  : "Manual sessions stay outside competitive totals."}
              </li>
              <li>
                {ar
                  ? "التعديل أو الحذف ينشئ تسوية ظاهرة."
                  : "Edits and deletions create visible adjustments."}
              </li>
            </ul>
          </section>
          <section>
            <div className="panel-heading">
              <h2>{ar ? "الشارات" : "Badges"}</h2>
              <span>{stats.badges.length}</span>
            </div>
            <div className="badge-list">
              {stats.badges.length ? (
                stats.badges.slice(0, 6).map((award) => (
                  <article key={award.id}>
                    <span aria-hidden="true">{badgeIcon(award.badge.iconKey)}</span>
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
    </main>
  );
}

function badgeIcon(icon: string) {
  return icon === "medal" ? "◎" : icon === "target" ? "⌖" : icon === "trend-up" ? "↗" : "⚑";
}
