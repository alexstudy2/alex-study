"use client";
import Link from "next/link";
import { useState } from "react";
type Person = { id: string; name: string; academicYear: number };
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
export function FriendsWorkspace({
  userId,
  locale,
  initialFriendships,
  initialRequests,
  initialPairs,
}: {
  userId: string;
  locale: "en" | "ar";
  initialFriendships: Friendship[];
  initialRequests: Friendship[];
  initialPairs: Pair[];
}) {
  const ar = locale === "ar",
    [friends, setFriends] = useState(initialFriendships),
    [requests, setRequests] = useState(initialRequests),
    [pairs, setPairs] = useState(initialPairs),
    [results, setResults] = useState<Person[]>([]),
    [message, setMessage] = useState("");
  async function call(url: string, method = "POST", body?: unknown) {
    setMessage("");
    const r = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      setMessage(ar ? "تعذر إكمال الإجراء." : "That action could not be completed.");
      return null;
    }
    return r.status === 204 ? {} : r.json();
  }
  async function search(form: FormData) {
    const q = String(form.get("q") || "");
    const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    const p = await r.json();
    setResults(r.ok ? p.users : []);
  }
  async function respond(f: Friendship, action: "accept" | "decline") {
    const p = await call(`/api/friends/requests/${f.id}/${action}`);
    if (p) {
      setRequests(requests.filter((x) => x.id !== f.id));
      if (action === "accept") setFriends([p.friendship, ...friends]);
    }
  }
  const person = (f: Friendship) => (f.requesterId === userId ? f.addressee : f.requester);
  return (
    <main className="social-shell" dir={ar ? "rtl" : "ltr"}>
      <header className="social-header">
        <div>
          <p className="eyebrow">{ar ? "الدعم المتبادل" : "Mutual support"}</p>
          <h1>{ar ? "الأصدقاء والمساءلة" : "Friends and accountability"}</h1>
          <p>
            {ar
              ? "اتصل بزملائك واختر شريك مساءلة بموافقة الطرفين."
              : "Connect with classmates and opt into low-pressure accountability together."}
          </p>
        </div>
        <div className="inline-actions">
          <Link className="secondary-button" href="/leaderboard">
            {ar ? "المتصدرون" : "Leaderboard"}
          </Link>
          <Link className="secondary-button" href="/challenges">
            {ar ? "التحديات" : "Challenges"}
          </Link>
          <Link className="secondary-button" href="/notifications">
            {ar ? "الإشعارات" : "Notifications"}
          </Link>
        </div>
      </header>
      {message && (
        <p role="alert" className="form-error">
          {message}
        </p>
      )}
      <section className="social-panel">
        <h2>{ar ? "ابحث عن طالب" : "Find a student"}</h2>
        <form action={search} className="social-search">
          <label>
            <span className="sr-only">{ar ? "الاسم أو الرقم الجامعي" : "Name or college ID"}</span>
            <input
              name="q"
              minLength={2}
              required
              placeholder={ar ? "الاسم أو الرقم الجامعي" : "Name or college ID"}
            />
          </label>
          <button className="primary-button">{ar ? "بحث" : "Search"}</button>
        </form>
        <div className="social-list">
          {results.map((u) => (
            <article key={u.id}>
              <div>
                <strong>{u.name}</strong>
                <span>{ar ? `السنة ${u.academicYear}` : `Year ${u.academicYear}`}</span>
              </div>
              <button
                className="secondary-button"
                onClick={async () => {
                  if (await call("/api/friends/requests", "POST", { userId: u.id }))
                    setResults(results.filter((x) => x.id !== u.id));
                }}
              >
                {ar ? "إرسال طلب" : "Add friend"}
              </button>
            </article>
          ))}
        </div>
      </section>
      <div className="social-columns">
        <section className="social-panel">
          <h2>{ar ? "الطلبات" : "Requests"}</h2>
          <div className="social-list">
            {requests.length ? (
              requests.map((f) => (
                <article key={f.id}>
                  <div>
                    <strong>{person(f).name}</strong>
                    <span>
                      {f.addresseeId === userId
                        ? ar
                          ? "طلب وارد"
                          : "Incoming request"
                        : ar
                          ? "قيد الانتظار"
                          : "Pending"}
                    </span>
                  </div>
                  {f.addresseeId === userId && (
                    <div className="inline-actions">
                      <button className="primary-button" onClick={() => respond(f, "accept")}>
                        {ar ? "قبول" : "Accept"}
                      </button>
                      <button className="secondary-button" onClick={() => respond(f, "decline")}>
                        {ar ? "رفض" : "Decline"}
                      </button>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="muted-copy">{ar ? "لا توجد طلبات معلقة." : "No pending requests."}</p>
            )}
          </div>
        </section>
        <section className="social-panel">
          <h2>{ar ? "الأصدقاء" : "Friends"}</h2>
          <div className="social-list">
            {friends.length ? (
              friends.map((f) => (
                <article key={f.id}>
                  <div>
                    <strong>{person(f).name}</strong>
                    <span>
                      {ar ? `السنة ${person(f).academicYear}` : `Year ${person(f).academicYear}`}
                    </span>
                  </div>
                  <div className="inline-actions">
                    <button
                      className="secondary-button"
                      onClick={async () => {
                        const p = await call("/api/accountability/invites", "POST", {
                          friendshipId: f.id,
                        });
                        if (p) setPairs([p.pair, ...pairs]);
                      }}
                    >
                      {ar ? "دعوة للمساءلة" : "Invite partner"}
                    </button>
                    <button
                      className="text-button"
                      onClick={async () => {
                        if (await call(`/api/friends/${f.id}`, "DELETE"))
                          setFriends(friends.filter((x) => x.id !== f.id));
                      }}
                    >
                      {ar ? "إزالة" : "Remove"}
                    </button>
                    <button
                      className="danger-button"
                      onClick={async () => {
                        if (await call(`/api/friends/${f.id}/block`))
                          setFriends(friends.filter((x) => x.id !== f.id));
                      }}
                    >
                      {ar ? "حظر" : "Block"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted-copy">
                {ar ? "أضف صديقًا للبدء." : "Add a friend to get started."}
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="social-panel">
        <h2>{ar ? "شركاء المساءلة" : "Accountability partners"}</h2>
        <p className="muted-copy">
          {ar
            ? "تذكير واحد كحد أقصى كل 24 ساعة عند غياب جلسة مكتملة، ويمكن الإيقاف أو الإنهاء في أي وقت."
            : "At most one reminder per 24 hours after no completed session, with pause and end controls at any time."}
        </p>
        <div className="social-list">
          {pairs.map((p) => {
            const other = p.userAId === userId ? p.userB : p.userA;
            return (
              <article key={p.id}>
                <div>
                  <strong>{other.name}</strong>
                  <span>{p.status}</span>
                </div>
                <div className="inline-actions">
                  {p.status === "PENDING" && p.createdById !== userId && (
                    <button
                      className="primary-button"
                      onClick={async () => {
                        const x = await call(`/api/accountability/${p.id}/accept`);
                        if (x) setPairs(pairs.map((v) => (v.id === p.id ? x.pair : v)));
                      }}
                    >
                      {ar ? "قبول" : "Accept"}
                    </button>
                  )}
                  {["ACTIVE", "PAUSED"].includes(p.status) && (
                    <button
                      className="secondary-button"
                      onClick={async () => {
                        const status = p.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                          x = await call(`/api/accountability/${p.id}`, "PATCH", { status });
                        if (x) setPairs(pairs.map((v) => (v.id === p.id ? { ...v, status } : v)));
                      }}
                    >
                      {p.status === "ACTIVE"
                        ? ar
                          ? "إيقاف مؤقت"
                          : "Pause"
                        : ar
                          ? "استئناف"
                          : "Resume"}
                    </button>
                  )}
                  <button
                    className="text-button"
                    onClick={async () => {
                      if (await call(`/api/accountability/${p.id}`, "DELETE"))
                        setPairs(pairs.filter((x) => x.id !== p.id));
                    }}
                  >
                    {ar ? "إنهاء" : "End"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
