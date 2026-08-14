"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  Shield,
  HeartHandshake,
  Trophy,
  Bell,
  Trash2,
  Ban,
  Pause,
  Play,
} from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

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
  const ar = locale === "ar";
  const [friends, setFriends] = useState(initialFriendships);
  const [requests, setRequests] = useState(initialRequests);
  const [pairs, setPairs] = useState(initialPairs);
  const [results, setResults] = useState<Person[]>([]);
  const [message, setMessage] = useState("");

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
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        eyebrow={ar ? "الدعم المتبادل" : "Mutual support"}
        title={ar ? "الأصدقاء والمساءلة" : "Friends and accountability"}
        description={
          ar
            ? "اتصل بزملائك واختر شريك مساءلة بموافقة الطرفين."
            : "Connect with classmates and opt into low-pressure accountability together."
        }
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/leaderboard">
              {ar ? "المتصدرون" : "Leaderboard"}
            </Link>
            <Link className="page-header-link" href="/challenges">
              {ar ? "التحديات" : "Challenges"}
            </Link>
            <Link className="page-header-link" href="/notifications">
              {ar ? "الإشعارات" : "Notifications"}
            </Link>
          </div>
        }
      />

      {message && (
        <p role="alert" className="form-error mb-4">
          {message}
        </p>
      )}

      <section className="social-panel">
        <h2 className="flex items-center gap-2">
          <Search className="w-5 h-5 text-muted" />
          <span>{ar ? "ابحث عن طالب" : "Find a student"}</span>
        </h2>
        <form action={search} className="social-search mt-3">
          <label className="flex-1">
            <span className="sr-only">{ar ? "الاسم أو الرقم الجامعي" : "Name or college ID"}</span>
            <input
              name="q"
              minLength={2}
              required
              placeholder={ar ? "الاسم أو الرقم الجامعي..." : "Search by name or college ID..."}
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            leftIcon={<Search className="w-4 h-4" />}
          >
            {ar ? "بحث" : "Search"}
          </Button>
        </form>
        {results.length > 0 && (
          <div className="social-list mt-4">
            {results.map((u) => (
              <article key={u.id}>
                <div>
                  <strong>{u.name}</strong>
                  <span className="text-muted text-xs block">
                    {ar ? `السنة ${u.academicYear}` : `Year ${u.academicYear}`}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                  onClick={async () => {
                    if (await call("/api/friends/requests", "POST", { userId: u.id }))
                      setResults(results.filter((x) => x.id !== u.id));
                  }}
                >
                  {ar ? "إرسال طلب" : "Add friend"}
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="social-columns mt-6">
        <section className="social-panel">
          <h2 className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            <span>{ar ? "الطلبات" : "Requests"}</span>
          </h2>
          <div className="social-list mt-3">
            {requests.length ? (
              requests.map((f) => (
                <article key={f.id}>
                  <div>
                    <strong>{person(f).name}</strong>
                    <span className="text-muted text-xs block">
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
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                        onClick={() => respond(f, "accept")}
                      >
                        {ar ? "قبول" : "Accept"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<X className="w-3.5 h-3.5" />}
                        onClick={() => respond(f, "decline")}
                      >
                        {ar ? "رفض" : "Decline"}
                      </Button>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="muted-copy text-sm text-muted">
                {ar ? "لا توجد طلبات معلقة." : "No pending requests."}
              </p>
            )}
          </div>
        </section>

        <section className="social-panel">
          <h2 className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <span>{ar ? "الأصدقاء" : "Friends"}</span>
          </h2>
          <div className="social-list mt-3">
            {friends.length ? (
              friends.map((f) => (
                <article key={f.id}>
                  <div>
                    <strong>{person(f).name}</strong>
                    <span className="text-muted text-xs block">
                      {ar ? `السنة ${person(f).academicYear}` : `Year ${person(f).academicYear}`}
                    </span>
                  </div>
                  <div className="inline-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<HeartHandshake className="w-3.5 h-3.5" />}
                      onClick={async () => {
                        const p = await call("/api/accountability/invites", "POST", {
                          friendshipId: f.id,
                        });
                        if (p) setPairs([p.pair, ...pairs]);
                      }}
                    >
                      {ar ? "دعوة للمساءلة" : "Invite partner"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 className="w-3.5 h-3.5 text-muted" />}
                      onClick={async () => {
                        if (await call(`/api/friends/${f.id}`, "DELETE"))
                          setFriends(friends.filter((x) => x.id !== f.id));
                      }}
                    >
                      {ar ? "إزالة" : "Remove"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<Ban className="w-3.5 h-3.5" />}
                      onClick={async () => {
                        if (await call(`/api/friends/${f.id}/block`))
                          setFriends(friends.filter((x) => x.id !== f.id));
                      }}
                    >
                      {ar ? "حظر" : "Block"}
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted-copy text-sm text-muted">
                {ar ? "أضف صديقًا للبدء." : "Add a friend to get started."}
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="social-panel mt-6">
        <h2 className="flex items-center gap-2">
          <HeartHandshake className="w-5 h-5 text-accent" />
          <span>{ar ? "شركاء المساءلة" : "Accountability partners"}</span>
        </h2>
        <p className="muted-copy text-sm text-muted mt-1">
          {ar
            ? "تذكير واحد كحد أقصى كل 24 ساعة عند غياب جلسة مكتملة، ويمكن الإيقاف أو الإنهاء في أي وقت."
            : "At most one reminder per 24 hours after no completed session, with pause and end controls at any time."}
        </p>
        <div className="social-list mt-3">
          {pairs.length ? (
            pairs.map((p) => {
              const other = p.userAId === userId ? p.userB : p.userA;
              return (
                <article key={p.id}>
                  <div>
                    <strong>{other.name}</strong>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-sunken border border-line ml-2 mr-2 font-medium">
                      {p.status}
                    </span>
                  </div>
                  <div className="inline-actions">
                    {p.status === "PENDING" && p.createdById !== userId && (
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                        onClick={async () => {
                          const x = await call(`/api/accountability/${p.id}/accept`);
                          if (x) setPairs(pairs.map((v) => (v.id === p.id ? x.pair : v)));
                        }}
                      >
                        {ar ? "قبول" : "Accept"}
                      </Button>
                    )}
                    {["ACTIVE", "PAUSED"].includes(p.status) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={
                          p.status === "ACTIVE" ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )
                        }
                        onClick={async () => {
                          const status = p.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
                          const x = await call(`/api/accountability/${p.id}`, "PATCH", { status });
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
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<X className="w-3.5 h-3.5 text-muted" />}
                      onClick={async () => {
                        if (await call(`/api/accountability/${p.id}`, "DELETE"))
                          setPairs(pairs.filter((x) => x.id !== p.id));
                      }}
                    >
                      {ar ? "إنهاء" : "End"}
                    </Button>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="muted-copy text-sm text-muted">
              {ar ? "لا يوجد شركاء مساءلة حاليًا." : "No active accountability partners."}
            </p>
          )}
        </div>
      </section>
    </PageShell>
  );
}
