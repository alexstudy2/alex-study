"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Square,
  Users,
} from "lucide-react";

type Timer = {
  id: string;
  mode: "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";
  status: "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  durationSeconds: number;
  segmentStartedAt: string | Date | null;
  accumulatedActiveSeconds: number;
  version: number;
};
type Member = {
  id: string;
  role: string;
  lastSeenAt: string | Date | null;
  lobbyTaskTitle: string | null;
  lobbyTaskCompleted: boolean;
  lobbyTaskUpdatedAt: string | Date | null;
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
  currentUserId,
}: {
  initialRoom: Room;
  role: string;
  locale: "en" | "ar";
  serverNow: string;
  currentUserId: string;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [offset, setOffset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [chatText, setChatText] = useState("");
  const [taskTitle, setTaskTitle] = useState(
    initialRoom.members.find((member) => member.user.id === currentUserId)?.lobbyTaskTitle ?? "",
  );
  const [timerMode, setTimerMode] = useState<Timer["mode"]>("FOCUS");
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [timerBusy, setTimerBusy] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [error, setError] = useState("");
  const ar = locale === "ar";
  const timer = room.timerRuns[0] ?? null;
  const control = role === "OWNER" || role === "MODERATOR";

  const refreshRoom = useCallback(async () => {
    const response = await fetch(`/api/lobbies/${room.id}`).catch(() => null);
    if (!response?.ok) return;
    const payload = await response.json();
    setRoom(payload.room);
    setOffset(new Date(payload.serverNow).getTime() - Date.now());
  }, [room.id]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
      void refreshRoom();
    }, 5000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(clock);
    };
  }, [refreshRoom]);

  const remaining = useMemo(() => {
    if (!timer) return durationMinutes * 60;
    const segment = timer.status === "RUNNING" && timer.segmentStartedAt
      ? Math.max(0, Math.floor((now + offset - new Date(timer.segmentStartedAt).getTime()) / 1000))
      : 0;
    return Math.max(0, timer.durationSeconds - timer.accumulatedActiveSeconds - segment);
  }, [timer, durationMinutes, now, offset]);
  const progress = timer
    ? Math.min(100, Math.round(((timer.durationSeconds - remaining) / timer.durationSeconds) * 100))
    : 0;

  async function start() {
    setTimerBusy(true);
    setError("");
    const response = await fetch(`/api/lobbies/${room.id}/timer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: timerMode, durationSeconds: durationMinutes * 60 }),
    }).catch(() => null);
    setTimerBusy(false);
    if (!response?.ok) setError(ar ? "تعذر بدء المؤقت." : "Could not start the timer.");
    else await refreshRoom();
  }

  async function act(action: "pause" | "resume" | "complete" | "cancel") {
    if (!timer) return;
    setTimerBusy(true);
    setError("");
    const response = await fetch(`/api/lobbies/${room.id}/timer/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: timer.version }),
    }).catch(() => null);
    setTimerBusy(false);
    if (!response?.ok) setError(ar ? "تعذر تحديث المؤقت. حاول مجددًا." : "Could not update the timer. Try again.");
    else await refreshRoom();
  }

  async function saveTask(completed = false) {
    if (taskBusy) return;
    setTaskBusy(true);
    setError("");
    const response = await fetch(`/api/lobbies/${room.id}/me`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: taskTitle.trim() || null, completed }),
    }).catch(() => null);
    setTaskBusy(false);
    if (!response?.ok) setError(ar ? "تعذر حفظ مهمتك." : "Could not save your task.");
    else await refreshRoom();
  }

  async function toggleOwnTask(member: Member) {
    setTaskTitle(member.lobbyTaskTitle ?? "");
    setTaskBusy(true);
    const response = await fetch(`/api/lobbies/${room.id}/me`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: member.lobbyTaskTitle, completed: !member.lobbyTaskCompleted }),
    }).catch(() => null);
    setTaskBusy(false);
    if (response?.ok) await refreshRoom();
    else setError(ar ? "تعذر تحديث المهمة." : "Could not update the task.");
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!chatText.trim() || chatBusy) return;
    setChatBusy(true);
    setError("");
    const response = await fetch(`/api/lobbies/${room.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: chatText }),
    }).catch(() => null);
    setChatBusy(false);
    if (!response?.ok) {
      setError(ar ? "تعذر إرسال الرسالة." : "Could not send the message.");
      return;
    }
    const payload = await response.json();
    setRoom((current) => ({ ...current, messages: [...current.messages, payload.message] }));
    setChatText("");
  }

  return (
    <section className="lobby-studio" dir={ar ? "rtl" : "ltr"}>
      {error && <p className="insight-alert" role="alert">{error}</p>}

      <div className="lobby-studio-grid">
        <main className="lobby-primary-column">
          <section className="lobby-timer-card">
            <header className="lobby-section-heading">
              <div><Clock3 aria-hidden="true" /><div><p className="eyebrow">{ar ? "مؤقت المجموعة" : "Group timer"}</p><h2>{timer ? modeLabel(timer.mode, ar) : ar ? "جهّز الجلسة" : "Set up the session"}</h2></div></div>
              {timer && <span className={`lobby-timer-status ${timer.status.toLowerCase()}`}>{timer.status === "RUNNING" ? (ar ? "يعمل" : "Running") : ar ? "متوقف" : "Paused"}</span>}
            </header>

            {!timer && control && (
              <div className="lobby-timer-setup">
                <label><span>{ar ? "الوضع" : "Mode"}</span><select value={timerMode} onChange={(event) => setTimerMode(event.target.value as Timer["mode"])}><option value="FOCUS">{ar ? "تركيز" : "Focus"}</option><option value="SHORT_BREAK">{ar ? "راحة قصيرة" : "Short break"}</option><option value="LONG_BREAK">{ar ? "راحة طويلة" : "Long break"}</option></select></label>
                <label><span>{ar ? "الدقائق" : "Minutes"}</span><input type="number" min="1" max="240" value={durationMinutes} onChange={(event) => setDurationMinutes(Math.min(240, Math.max(1, Number(event.target.value) || 1)))} /></label>
                <div className="lobby-duration-presets">{[15, 25, 45, 60].map((minutes) => <button type="button" key={minutes} className={durationMinutes === minutes ? "active" : ""} onClick={() => setDurationMinutes(minutes)}>{minutes}</button>)}</div>
              </div>
            )}

            <div className="lobby-timer-display">
              <output>{formatClock(remaining)}</output>
              <div className="lobby-timer-progress"><span style={{ width: `${progress}%` }} /></div>
              <small>{timer ? `${progress}%` : ar ? "ابدأ عندما يكون الجميع جاهزًا" : "Start when everyone is ready"}</small>
            </div>

            {control && <div className="timer-actions lobby-timer-actions">
              {!timer && <button className="primary-button" disabled={timerBusy} onClick={start}><Play aria-hidden="true" />{ar ? "ابدأ الجلسة" : "Start session"}</button>}
              {timer?.status === "RUNNING" && <button className="primary-button" disabled={timerBusy} onClick={() => act("pause")}><Pause aria-hidden="true" />{ar ? "إيقاف مؤقت" : "Pause"}</button>}
              {timer?.status === "PAUSED" && <button className="primary-button" disabled={timerBusy} onClick={() => act("resume")}><Play aria-hidden="true" />{ar ? "متابعة" : "Resume"}</button>}
              {timer && <button className="secondary-button" disabled={timerBusy} onClick={() => act("complete")}><Check aria-hidden="true" />{ar ? "إنهاء" : "Complete"}</button>}
              {timer && <button className="lobby-cancel-button" disabled={timerBusy} onClick={() => act("cancel")} title={ar ? "إلغاء" : "Cancel"}><Square aria-hidden="true" /><span className="sr-only">{ar ? "إلغاء" : "Cancel"}</span></button>}
            </div>}
          </section>

          <section className="lobby-task-board">
            <header className="lobby-section-heading"><div><CheckCircle2 aria-hidden="true" /><div><p className="eyebrow">{ar ? "لوحة العمل" : "Work board"}</p><h2>{ar ? "كل شخص يعمل على ماذا؟" : "What is everyone working on?"}</h2></div></div></header>
            <form className="lobby-my-task-form" onSubmit={(event) => { event.preventDefault(); void saveTask(false); }}>
              <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} maxLength={180} placeholder={ar ? "مهمتك في هذه الجلسة (اختياري)" : "Your task for this session (optional)"} />
              <button className="primary-button" disabled={taskBusy}>{ar ? "ثبّت المهمة" : "Pin task"}</button>
            </form>
            <div className="lobby-sticky-grid">
              {room.members.filter((member) => member.lobbyTaskTitle).map((member) => {
                const own = member.user.id === currentUserId;
                return <article className={`lobby-task-sticky ${member.lobbyTaskCompleted ? "completed" : ""}`} key={member.id}>
                  <span className="lobby-sticky-owner">{member.user.name.split(" ")[0]}</span>
                  <p>{member.lobbyTaskTitle}</p>
                  <div className="lobby-member-progress"><span style={{ width: `${member.lobbyTaskCompleted ? 100 : progress}%` }} /></div>
                  <footer><small>{member.lobbyTaskCompleted ? (ar ? "تمت" : "Done") : `${progress}%`}</small>{own && <button type="button" disabled={taskBusy} onClick={() => toggleOwnTask(member)}>{member.lobbyTaskCompleted ? <RotateCcw aria-hidden="true" /> : <Check aria-hidden="true" />}{member.lobbyTaskCompleted ? (ar ? "إعادة فتح" : "Reopen") : ar ? "تمت" : "Done"}</button>}</footer>
                </article>;
              })}
              {!room.members.some((member) => member.lobbyTaskTitle) && <p className="lobby-board-empty">{ar ? "لم يثبت أحد مهمة بعد." : "No one has pinned a task yet."}</p>}
            </div>
          </section>

          <section className="room-chat lobby-chat-card">
            <header className="lobby-section-heading"><div><MessageCircle aria-hidden="true" /><div><p className="eyebrow">{ar ? "دردشة الغرفة" : "Room chat"}</p><h2>{ar ? "حديث هادئ" : "Quiet chat"}</h2></div></div><span>{room.messages.length}</span></header>
            <div className="message-list lobby-message-list" aria-live="polite">
              {room.messages.map((item) => <article className={item.user.id === currentUserId ? "own" : ""} key={item.id}><div className="message-avatar">{item.user.name.charAt(0).toUpperCase()}</div><div><strong>{item.user.name.split(" ")[0]} · Y{item.user.academicYear}</strong><p>{item.body}</p><time>{new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</time></div></article>)}
            </div>
            {room.chatEnabled && <form onSubmit={send}><label className="sr-only" htmlFor="lobby-message">{ar ? "رسالة" : "Message"}</label><input id="lobby-message" value={chatText} onChange={(event) => setChatText(event.target.value)} maxLength={500} placeholder={ar ? "اكتب رسالة قصيرة…" : "Write a short message…"} /><button className="primary-button" disabled={chatBusy || !chatText.trim()}><Send aria-hidden="true" /><span>{ar ? "إرسال" : "Send"}</span></button></form>}
          </section>
        </main>

        <aside className="room-sidebar lobby-members-panel">
          <header><div><p className="eyebrow">{ar ? "المشاركون" : "Participants"}</p><h2><Users aria-hidden="true" />{room.members.length} / 25</h2></div></header>
          <ul>{room.members.map((member) => <li key={member.id}><span className="presence-dot" /><div className="lobby-member-info"><strong>{member.user.name.split(" ")[0]}</strong><small>{member.role} · Y{member.user.academicYear}</small><div className="lobby-member-progress"><span style={{ width: `${member.lobbyTaskCompleted ? 100 : progress}%` }} /></div></div><span className={member.lobbyTaskCompleted ? "member-done" : "member-progress-label"}>{member.lobbyTaskCompleted ? <Check aria-label={ar ? "تمت المهمة" : "Task done"} /> : `${progress}%`}</span></li>)}</ul>
          {control && <Link className="secondary-button" href={`/lobbies/${room.id}/settings`}><Settings aria-hidden="true" />{ar ? "إعدادات الغرفة" : "Room settings"}</Link>}
          <div className="lobby-focus-note"><Sparkles aria-hidden="true" /><p>{ar ? "شارك مهمتك اختياريًا، واحتفظ بالدردشة قصيرة حتى يظل الجميع مركزًا." : "Sharing a task is optional. Keep chat brief so the room stays focused."}</p></div>
        </aside>
      </div>
    </section>
  );
}

function formatClock(seconds: number) {
  return `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, "0")}:${(Math.max(0, seconds) % 60).toString().padStart(2, "0")}`;
}

function modeLabel(mode: Timer["mode"], ar: boolean) {
  if (mode === "FOCUS") return ar ? "تركيز جماعي" : "Group focus";
  if (mode === "SHORT_BREAK") return ar ? "راحة قصيرة" : "Short break";
  return ar ? "راحة طويلة" : "Long break";
}
