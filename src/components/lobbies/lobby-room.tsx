"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
type Timer = {
  id: string;
  mode: string;
  status: string;
  durationSeconds: number;
  segmentStartedAt: string | Date | null;
  accumulatedActiveSeconds: number;
  version: number;
};
type Member = {
  id: string;
  role: string;
  lastSeenAt: string | Date | null;
  user: { id: string; name: string; academicYear: number };
};
type Message = {
  id: string;
  body: string;
  createdAt: string | Date;
  user: { id: string; name: string; academicYear: number };
};
type Room = {
  id: string;
  name: string;
  description: string | null;
  chatEnabled: boolean;
  members: Member[];
  timerRuns: Timer[];
  messages: Message[];
};
export function LobbyRoom({
  initialRoom,
  role,
  locale,
  serverNow,
}: {
  initialRoom: Room;
  role: string;
  locale: "en" | "ar";
  serverNow: string;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [offset, setOffset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const ar = locale === "ar",
    timer = room.timerRuns[0] ?? null,
    control = role === "OWNER" || role === "MODERATOR";
  useEffect(() => {
    const i = setInterval(async () => {
      setNow(Date.now());
      const r = await fetch(`/api/lobbies/${room.id}`);
      if (r.ok) {
        const p = await r.json();
        setRoom(p.room);
        setOffset(new Date(p.serverNow).getTime() - Date.now());
      }
    }, 5000);
    return () => clearInterval(i);
  }, [room.id]);
  const remaining = useMemo(() => {
    if (!timer) return 0;
    const segment =
      timer.status === "RUNNING" && timer.segmentStartedAt
        ? Math.max(
            0,
            Math.floor((now + offset - new Date(timer.segmentStartedAt).getTime()) / 1000),
          )
        : 0;
    return Math.max(0, timer.durationSeconds - timer.accumulatedActiveSeconds - segment);
  }, [timer, now, offset]);
  async function start() {
    setBusy(true);
    await fetch(`/api/lobbies/${room.id}/timer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "FOCUS", durationSeconds: 1500 }),
    });
    setBusy(false);
  }
  async function act(action: string) {
    if (!timer) return;
    setBusy(true);
    await fetch(`/api/lobbies/${room.id}/timer/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: timer.version }),
    });
    setBusy(false);
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    const r = await fetch(`/api/lobbies/${room.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: message }),
    });
    if (r.ok) {
      setRoom({ ...room, messages: [...room.messages, (await r.json()).message] });
      setMessage("");
    }
  }
  return (
    <section className="lobby-room" dir={ar ? "rtl" : "ltr"}>
      <div className="room-main">
        <div className="room-timer">
          <p className="eyebrow">
            {timer
              ? timer.mode === "FOCUS"
                ? ar
                  ? "تركيز جماعي"
                  : "Group focus"
                : ar
                  ? "راحة"
                  : "Break"
              : ar
                ? "الغرفة جاهزة"
                : "Room ready"}
          </p>
          <output>
            {timer
              ? `${Math.floor(remaining / 60)
                  .toString()
                  .padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`
              : "25:00"}
          </output>
          <p>
            {timer?.status === "PAUSED"
              ? ar
                ? "متوقف مؤقتًا"
                : "Paused"
              : ar
                ? "المؤقت مبني على وقت الخادم"
                : "Server-authoritative timer"}
          </p>
          {control && (
            <div className="timer-actions">
              {!timer && (
                <button className="primary-button" disabled={busy} onClick={start}>
                  {ar ? "ابدأ" : "Start"}
                </button>
              )}
              {timer?.status === "RUNNING" && (
                <button className="primary-button" onClick={() => act("pause")}>
                  {ar ? "إيقاف مؤقت" : "Pause"}
                </button>
              )}
              {timer?.status === "PAUSED" && (
                <button className="primary-button" onClick={() => act("resume")}>
                  {ar ? "متابعة" : "Resume"}
                </button>
              )}
              {timer && (
                <button className="secondary-button" onClick={() => act("complete")}>
                  {ar ? "إنهاء" : "Complete"}
                </button>
              )}
            </div>
          )}
        </div>
        <section className="room-chat">
          <h2>{ar ? "حديث هادئ" : "Quiet chat"}</h2>
          <div className="message-list">
            {room.messages.map((item) => (
              <article key={item.id}>
                <strong>
                  {item.user.name.split(" ")[0]} · Y{item.user.academicYear}
                </strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          {room.chatEnabled && (
            <form onSubmit={send}>
              <label className="sr-only" htmlFor="message">
                {ar ? "رسالة" : "Message"}
              </label>
              <input
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
              />
              <button className="primary-button">{ar ? "إرسال" : "Send"}</button>
            </form>
          )}
        </section>
      </div>
      <aside className="room-sidebar">
        <div>
          <p className="eyebrow">{ar ? "الحضور" : "Presence"}</p>
          <h2>{room.members.length} / 25</h2>
        </div>
        <ul>
          {room.members.map((item) => (
            <li key={item.id}>
              <span className="presence-dot" />
              <div>
                <strong>{item.user.name.split(" ")[0]}</strong>
                <small>
                  {item.role} · Y{item.user.academicYear}
                </small>
              </div>
            </li>
          ))}
        </ul>
        {control && (
          <Link href={`/lobbies/${room.id}/settings`}>
            {ar ? "إعدادات الغرفة" : "Room settings"}
          </Link>
        )}
      </aside>
    </section>
  );
}
