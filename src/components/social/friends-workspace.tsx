"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Ban,
  Check,
  ChevronDown,
  Clock,
  HeartHandshake,
  Inbox,
  Pause,
  Play,
  Search,
  Send,
  Swords,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

type Person = { id: string; name: string; academicYear: number };
type Relationship = "none" | "friends" | "incoming" | "outgoing" | "blocked";
type SearchHit = Person & { relationship: Relationship };
type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: string;
  requester: Person;
  addressee: Person;
};
type Pair = {
  id: string;
  userAId: string;
  userBId: string;
  createdById: string;
  status: string;
  userA: Person;
  userB: Person;
};

/* One table instead of ~50 inline `ar ? … : …` ternaries -- the idiom settings-workspace already
   uses. Both objects carry the same keys, so a missing translation is a type error rather than an
   English string leaking into the Arabic page. */
const COPY = {
  en: {
    eyebrow: "Mutual support",
    title: "Friends and accountability",
    description:
      "Find classmates, agree on a challenge, and opt into gentle accountability together.",
    leaderboard: "Leaderboard",
    challenges: "Challenges",
    notifications: "Notifications",
    vitalsFriends: "Friends",
    vitalsRequests: "Awaiting you",
    vitalsPartners: "Partners",
    findTitle: "Find a student",
    findHint: "Search by name or college ID. Only students who allow college visibility appear.",
    findLabel: "Name or college ID",
    findPlaceholder: "Name or college ID…",
    searching: "Searching…",
    search: "Search",
    clear: "Clear",
    noMatches: "No students matched that search.",
    add: "Add friend",
    sent: "Request sent",
    alreadyFriends: "Already friends",
    respondBelow: "Wants to add you",
    requestsTitle: "Requests",
    incoming: "Waiting for you",
    outgoing: "Sent by you",
    noRequests: "No pending requests.",
    accept: "Accept",
    decline: "Decline",
    withdraw: "Withdraw",
    friendsTitle: "Your friends",
    noFriends: "No friends yet. Search above to send your first request.",
    challenge: "Challenge",
    openChallenge: "Open challenge",
    invitePartner: "Invite as partner",
    partnered: "Partnered",
    more: "More",
    remove: "Remove friend",
    block: "Block",
    confirmRemove: "Remove this friend?",
    confirmBlock: "Block this student?",
    confirmYes: "Yes",
    confirmNo: "Keep",
    partnersTitle: "Accountability partners",
    partnersHint:
      "At most one reminder per 24 hours after a day with no completed session. Pause or end it whenever you like.",
    noPartners: "No accountability partners yet. Invite one from a friend card above.",
    statusPENDING: "Invitation pending",
    statusACTIVE: "Active",
    statusPAUSED: "Paused",
    pause: "Pause",
    resume: "Resume",
    end: "End pairing",
    failed: "That action could not be completed.",
    unavailable: "You are already connected with this student.",
    requestSentToast: "Request sent.",
    year: (year: number) => `Year ${year}`,
  },
  ar: {
    eyebrow: "الدعم المتبادل",
    title: "الأصدقاء والمساءلة",
    description: "ابحث عن زملائك، واتفقوا على تحدٍ، واختاروا مساءلة لطيفة بموافقة الطرفين.",
    leaderboard: "المتصدرون",
    challenges: "التحديات",
    notifications: "الإشعارات",
    vitalsFriends: "الأصدقاء",
    vitalsRequests: "بانتظارك",
    vitalsPartners: "الشركاء",
    findTitle: "ابحث عن طالب",
    findHint: "ابحث بالاسم أو الرقم الجامعي. يظهر الطلاب الذين سمحوا بالظهور داخل الكلية فقط.",
    findLabel: "الاسم أو الرقم الجامعي",
    findPlaceholder: "الاسم أو الرقم الجامعي…",
    searching: "جارٍ البحث…",
    search: "بحث",
    clear: "مسح",
    noMatches: "لا نتائج مطابقة لهذا البحث.",
    add: "إرسال طلب",
    sent: "تم إرسال الطلب",
    alreadyFriends: "صديق بالفعل",
    respondBelow: "أرسل لك طلبًا",
    requestsTitle: "الطلبات",
    incoming: "بانتظار ردك",
    outgoing: "أرسلتها أنت",
    noRequests: "لا توجد طلبات معلقة.",
    accept: "قبول",
    decline: "رفض",
    withdraw: "سحب الطلب",
    friendsTitle: "أصدقاؤك",
    noFriends: "لا أصدقاء بعد. ابحث بالأعلى لإرسال أول طلب.",
    challenge: "تحدَّه",
    openChallenge: "فتح التحدي",
    invitePartner: "دعوة للمساءلة",
    partnered: "شريك مساءلة",
    more: "المزيد",
    remove: "إزالة الصديق",
    block: "حظر",
    confirmRemove: "إزالة هذا الصديق؟",
    confirmBlock: "حظر هذا الطالب؟",
    confirmYes: "نعم",
    confirmNo: "إبقاء",
    partnersTitle: "شركاء المساءلة",
    partnersHint:
      "تذكير واحد كحد أقصى كل ٢٤ ساعة بعد يوم بلا جلسة مكتملة، ويمكن الإيقاف أو الإنهاء في أي وقت.",
    noPartners: "لا يوجد شركاء مساءلة بعد. ابدأ الدعوة من بطاقة صديق بالأعلى.",
    statusPENDING: "بانتظار الرد",
    statusACTIVE: "نشِط",
    statusPAUSED: "موقوف مؤقتًا",
    pause: "إيقاف مؤقت",
    resume: "استئناف",
    end: "إنهاء الشراكة",
    failed: "تعذر إكمال الإجراء.",
    unavailable: "بينكما ارتباط قائم بالفعل.",
    requestSentToast: "تم إرسال الطلب.",
    year: (year: number) => `السنة ${year}`,
  },
} as const;

/** Drawn initial rather than a photo: nothing in the app uploads one, and an empty <img> frame on
    every card is worse than a letter. The year tints it, so the same person keeps the same colour. */
function Avatar({ person }: { person: Person }) {
  return (
    <span className="friend-avatar" data-year={person.academicYear} aria-hidden="true">
      {person.name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

export function FriendsWorkspace({
  userId,
  locale,
  initialFriendships,
  initialRequests,
  initialPairs,
  openChallengeByFriend,
}: {
  userId: string;
  locale: "en" | "ar";
  initialFriendships: Friendship[];
  initialRequests: Friendship[];
  initialPairs: Pair[];
  openChallengeByFriend: Record<string, string>;
}) {
  const ar = locale === "ar";
  const t = COPY[locale];
  const [friends, setFriends] = useState(initialFriendships);
  const [requests, setRequests] = useState(initialRequests);
  const [pairs, setPairs] = useState(initialPairs);
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  // One in-flight mutation at a time, keyed by card + verb. Every button used to stay live while
  // its own request was open, so a double tap sent the action twice.
  const [busy, setBusy] = useState("");
  const [armed, setArmed] = useState("");

  async function call(key: string, url: string, method = "POST", body?: unknown) {
    setNotice(null);
    setBusy(key);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setNotice({
          tone: "error",
          text: payload?.fields?.relationship?.[0] === "unavailable" ? t.unavailable : t.failed,
        });
        return null;
      }
      return response.status === 204 ? {} : await response.json();
    } catch {
      setNotice({ tone: "error", text: t.failed });
      return null;
    } finally {
      setBusy("");
      setArmed("");
    }
  }

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) return;
    setSearching(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`);
      const payload = await response.json().catch(() => null);
      setResults(response.ok && payload ? payload.users : []);
      if (!response.ok) setNotice({ tone: "error", text: t.failed });
    } catch {
      setResults([]);
      setNotice({ tone: "error", text: t.failed });
    } finally {
      setSearching(false);
    }
  }

  async function respond(friendship: Friendship, action: "accept" | "decline") {
    const payload = await call(
      `${friendship.id}:${action}`,
      `/api/friends/requests/${friendship.id}/${action}`,
    );
    if (!payload) return;
    setRequests((current) => current.filter((item) => item.id !== friendship.id));
    if (action === "accept") setFriends((current) => [payload.friendship, ...current]);
  }

  const person = (friendship: Friendship) =>
    friendship.requesterId === userId ? friendship.addressee : friendship.requester;
  const partnerOf = (personId: string) =>
    pairs.find(
      (pair) =>
        (pair.userAId === personId || pair.userBId === personId) &&
        ["PENDING", "ACTIVE", "PAUSED"].includes(pair.status),
    );
  const incoming = requests.filter((item) => item.addresseeId === userId);
  const outgoing = requests.filter((item) => item.requesterId === userId);

  const hitAction = (hit: SearchHit) => {
    if (hit.relationship === "friends")
      return (
        <span className="social-flag" data-tone="ok">
          <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
          {t.alreadyFriends}
        </span>
      );
    if (hit.relationship === "outgoing")
      return (
        <span className="social-flag">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          {t.sent}
        </span>
      );
    if (hit.relationship === "incoming")
      return (
        <span className="social-flag" data-tone="call">
          <Inbox className="w-3.5 h-3.5" aria-hidden="true" />
          {t.respondBelow}
        </span>
      );
    return (
      <Button
        variant="primary"
        size="sm"
        disabled={busy === `${hit.id}:add`}
        leftIcon={<Send className="w-3.5 h-3.5" />}
        onClick={async () => {
          if (await call(`${hit.id}:add`, "/api/friends/requests", "POST", { userId: hit.id })) {
            setResults(
              (current) =>
                current?.map((item) =>
                  item.id === hit.id ? { ...item, relationship: "outgoing" as const } : item,
                ) ?? null,
            );
            setNotice({ tone: "ok", text: t.requestSentToast });
          }
        }}
      >
        {t.add}
      </Button>
    );
  };

  return (
    <PageShell dir={ar ? "rtl" : "ltr"} className="friends-workspace">
      <PageHeader
        icon={Users}
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        isRtl={ar}
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/leaderboard">
              {t.leaderboard}
            </Link>
            <Link className="page-header-link" href="/challenges">
              {t.challenges}
            </Link>
            <Link className="page-header-link" href="/notifications">
              {t.notifications}
            </Link>
          </div>
        }
      />

      {/* Three counts before the panels, so the page opens with a state rather than three
          headings you have to read to learn there is nothing under them. */}
      <section className="friends-vitals" aria-label={t.title}>
        <article>
          <Users className="w-4 h-4" aria-hidden="true" />
          <strong>{friends.length}</strong>
          <span>{t.vitalsFriends}</span>
        </article>
        <article data-alert={incoming.length ? "on" : "off"}>
          <Inbox className="w-4 h-4" aria-hidden="true" />
          <strong>{incoming.length}</strong>
          <span>{t.vitalsRequests}</span>
        </article>
        <article>
          <HeartHandshake className="w-4 h-4" aria-hidden="true" />
          <strong>{pairs.filter((pair) => pair.status === "ACTIVE").length}</strong>
          <span>{t.vitalsPartners}</span>
        </article>
      </section>

      {notice && (
        <p className="social-notice" data-tone={notice.tone} role="alert">
          {notice.text}
        </p>
      )}

      <section className="social-panel friends-find">
        <div className="panel-heading">
          <div>
            <h2>
              <Search className="w-4 h-4" aria-hidden="true" />
              <span>{t.findTitle}</span>
            </h2>
            <p className="muted-copy">{t.findHint}</p>
          </div>
        </div>
        <form className="social-search" onSubmit={search}>
          <label className="social-search-field">
            <span className="sr-only">{t.findLabel}</span>
            <input
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              minLength={2}
              required
              autoComplete="off"
              placeholder={t.findPlaceholder}
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={searching}
            leftIcon={<Search className="w-4 h-4" />}
          >
            {searching ? t.searching : t.search}
          </Button>
          {results !== null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<X className="w-3.5 h-3.5" />}
              onClick={() => {
                setResults(null);
                setQuery("");
              }}
            >
              {t.clear}
            </Button>
          )}
        </form>
        {results !== null && (
          <div className="social-results" aria-live="polite">
            {results.length ? (
              results.map((hit) => (
                <article className="social-row" key={hit.id}>
                  <div className="friend-identity">
                    <Avatar person={hit} />
                    <div>
                      <strong>{hit.name}</strong>
                      <span className="year-pill">{t.year(hit.academicYear)}</span>
                    </div>
                  </div>
                  {hitAction(hit)}
                </article>
              ))
            ) : (
              <p className="social-empty">{t.noMatches}</p>
            )}
          </div>
        )}
      </section>

      <div className="social-columns">
        <section className="social-panel">
          <div className="panel-heading">
            <h2>
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              <span>{t.requestsTitle}</span>
            </h2>
            <span className="social-count">{requests.length}</span>
          </div>
          {requests.length ? (
            <>
              {incoming.length > 0 && (
                <>
                  <p className="social-group-label">{t.incoming}</p>
                  <div className="social-results">
                    {incoming.map((friendship) => (
                      <article className="social-row" key={friendship.id}>
                        <div className="friend-identity">
                          <Avatar person={person(friendship)} />
                          <div>
                            <strong>{person(friendship).name}</strong>
                            <span className="year-pill">
                              {t.year(person(friendship).academicYear)}
                            </span>
                          </div>
                        </div>
                        <div className="inline-actions">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busy === `${friendship.id}:accept`}
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                            onClick={() => respond(friendship, "accept")}
                          >
                            {t.accept}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy === `${friendship.id}:decline`}
                            leftIcon={<X className="w-3.5 h-3.5" />}
                            onClick={() => respond(friendship, "decline")}
                          >
                            {t.decline}
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {outgoing.length > 0 && (
                <>
                  <p className="social-group-label">{t.outgoing}</p>
                  <div className="social-results">
                    {outgoing.map((friendship) => (
                      <article className="social-row" key={friendship.id}>
                        <div className="friend-identity">
                          <Avatar person={person(friendship)} />
                          <div>
                            <strong>{person(friendship).name}</strong>
                            <span className="social-flag">
                              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                              {t.sent}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === `${friendship.id}:withdraw`}
                          leftIcon={<X className="w-3.5 h-3.5" />}
                          onClick={async () => {
                            if (
                              await call(
                                `${friendship.id}:withdraw`,
                                `/api/friends/${friendship.id}`,
                                "DELETE",
                              )
                            )
                              setRequests((current) =>
                                current.filter((item) => item.id !== friendship.id),
                              );
                          }}
                        >
                          {t.withdraw}
                        </Button>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="social-empty">{t.noRequests}</p>
          )}
        </section>

        <section className="social-panel">
          <div className="panel-heading">
            <h2>
              <Users className="w-4 h-4" aria-hidden="true" />
              <span>{t.friendsTitle}</span>
            </h2>
            <span className="social-count">{friends.length}</span>
          </div>
          {friends.length ? (
            <div className="friend-grid">
              {friends.map((friendship) => {
                const friend = person(friendship);
                const openChallenge = openChallengeByFriend[friend.id];
                const pair = partnerOf(friend.id);
                return (
                  <article className="friend-card" key={friendship.id}>
                    <div className="friend-identity">
                      <Avatar person={friend} />
                      <div>
                        <strong>{friend.name}</strong>
                        <span className="year-pill">{t.year(friend.academicYear)}</span>
                      </div>
                    </div>
                    <div className="friend-actions">
                      {openChallenge ? (
                        <Button
                          href={`/challenges/${openChallenge}`}
                          variant="secondary"
                          size="sm"
                          leftIcon={<Swords className="w-3.5 h-3.5" />}
                        >
                          {t.openChallenge}
                        </Button>
                      ) : (
                        <Button
                          href={`/challenges/new?opponent=${friend.id}`}
                          variant="primary"
                          size="sm"
                          leftIcon={<Swords className="w-3.5 h-3.5" />}
                        >
                          {t.challenge}
                        </Button>
                      )}
                      {pair ? (
                        <span className="social-flag" data-tone="ok">
                          <HeartHandshake className="w-3.5 h-3.5" aria-hidden="true" />
                          {t.partnered}
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy === `${friendship.id}:partner`}
                          leftIcon={<HeartHandshake className="w-3.5 h-3.5" />}
                          onClick={async () => {
                            const payload = await call(
                              `${friendship.id}:partner`,
                              "/api/accountability/invites",
                              "POST",
                              { friendshipId: friendship.id },
                            );
                            if (payload) setPairs((current) => [payload.pair, ...current]);
                          }}
                        >
                          {t.invitePartner}
                        </Button>
                      )}
                    </div>
                    {/* Remove and Block are one-way, so they sit behind a disclosure and then behind
                        a confirm -- not beside the two everyday actions where a thumb lands. */}
                    <details className="friend-more">
                      <summary>
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t.more}</span>
                      </summary>
                      {armed === `${friendship.id}:remove` ||
                      armed === `${friendship.id}:block` ? (
                        <div className="friend-confirm" role="alertdialog" aria-live="polite">
                          <span>
                            {armed === `${friendship.id}:remove` ? t.confirmRemove : t.confirmBlock}
                          </span>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={busy.startsWith(friendship.id)}
                            onClick={async () => {
                              const block = armed === `${friendship.id}:block`;
                              const done = await call(
                                `${friendship.id}:${block ? "block" : "remove"}`,
                                `/api/friends/${friendship.id}${block ? "/block" : ""}`,
                                block ? "POST" : "DELETE",
                              );
                              if (done) {
                                setFriends((current) =>
                                  current.filter((item) => item.id !== friendship.id),
                                );
                                setPairs((current) =>
                                  current.filter(
                                    (item) =>
                                      item.userAId !== friend.id && item.userBId !== friend.id,
                                  ),
                                );
                              }
                            }}
                          >
                            {t.confirmYes}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setArmed("")}>
                            {t.confirmNo}
                          </Button>
                        </div>
                      ) : (
                        <div className="inline-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => setArmed(`${friendship.id}:remove`)}
                          >
                            {t.remove}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Ban className="w-3.5 h-3.5" />}
                            onClick={() => setArmed(`${friendship.id}:block`)}
                          >
                            {t.block}
                          </Button>
                        </div>
                      )}
                    </details>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="social-empty">{t.noFriends}</p>
          )}
        </section>
      </div>

      <section className="social-panel">
        <div className="panel-heading">
          <div>
            <h2>
              <HeartHandshake className="w-4 h-4" aria-hidden="true" />
              <span>{t.partnersTitle}</span>
            </h2>
            <p className="muted-copy">{t.partnersHint}</p>
          </div>
          <span className="social-count">{pairs.length}</span>
        </div>
        {pairs.length ? (
          <div className="social-results">
            {pairs.map((pair) => {
              const other = pair.userAId === userId ? pair.userB : pair.userA;
              const status = pair.status as "PENDING" | "ACTIVE" | "PAUSED";
              return (
                <article className="social-row" key={pair.id}>
                  <div className="friend-identity">
                    <Avatar person={other} />
                    <div>
                      <strong>{other.name}</strong>
                      {/* Was the raw enum -- users read "PAUSED", in both languages. */}
                      <span className="pair-status" data-status={pair.status}>
                        {t[`status${status}`] ?? pair.status}
                      </span>
                    </div>
                  </div>
                  <div className="inline-actions">
                    {pair.status === "PENDING" && pair.createdById !== userId && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busy === `${pair.id}:accept`}
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                        onClick={async () => {
                          const payload = await call(
                            `${pair.id}:accept`,
                            `/api/accountability/${pair.id}/accept`,
                          );
                          if (payload)
                            setPairs((current) =>
                              current.map((item) => (item.id === pair.id ? payload.pair : item)),
                            );
                        }}
                      >
                        {t.accept}
                      </Button>
                    )}
                    {(pair.status === "ACTIVE" || pair.status === "PAUSED") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy === `${pair.id}:toggle`}
                        leftIcon={
                          pair.status === "ACTIVE" ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )
                        }
                        onClick={async () => {
                          const next = pair.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
                          const payload = await call(
                            `${pair.id}:toggle`,
                            `/api/accountability/${pair.id}`,
                            "PATCH",
                            { status: next },
                          );
                          if (payload)
                            setPairs((current) =>
                              current.map((item) =>
                                item.id === pair.id ? { ...item, status: next } : item,
                              ),
                            );
                        }}
                      >
                        {pair.status === "ACTIVE" ? t.pause : t.resume}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === `${pair.id}:end`}
                      leftIcon={<X className="w-3.5 h-3.5" />}
                      onClick={async () => {
                        if (
                          await call(
                            `${pair.id}:end`,
                            `/api/accountability/${pair.id}`,
                            "DELETE",
                          )
                        )
                          setPairs((current) => current.filter((item) => item.id !== pair.id));
                      }}
                    >
                      {t.end}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="social-empty">{t.noPartners}</p>
        )}
      </section>
    </PageShell>
  );
}
