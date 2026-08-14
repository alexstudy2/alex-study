"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function JoinButton({ roomId, label }: { roomId: string; label: string }) {
  const router = useRouter(),
    [error, setError] = useState("");
  async function join() {
    const r = await fetch(`/api/lobbies/${roomId}/join`, { method: "POST" });
    if (r.ok) router.push(`/lobbies/${roomId}`);
    else setError((await r.json()).error ?? "join_failed");
  }
  return (
    <div>
      <button className="primary-button" onClick={join}>
        {label}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
