"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function LobbyCreateForm({ locale }: { locale: "en" | "ar" }) {
  const router = useRouter(),
    [error, setError] = useState("");
  const ar = locale === "ar";
  async function submit(data: FormData) {
    const r = await fetch("/api/lobbies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        description: data.get("description"),
        visibility: data.get("visibility"),
        chatEnabled: true,
        maxMembers: Number(data.get("maxMembers")),
      }),
    });
    if (r.ok) router.push(`/lobbies/${(await r.json()).room.id}`);
    else setError(ar ? "تعذر إنشاء الغرفة" : "Could not create room");
  }
  return (
    <form className="lobby-form" action={submit}>
      <label>
        {ar ? "اسم الغرفة" : "Room name"}
        <input name="name" required maxLength={100} />
      </label>
      <label>
        {ar ? "الوصف" : "Description"}
        <textarea name="description" maxLength={500} />
      </label>
      <div className="form-grid">
        <label>
          {ar ? "الظهور" : "Visibility"}
          <select name="visibility">
            <option value="PUBLIC">{ar ? "عامة" : "Public"}</option>
            <option value="PRIVATE">{ar ? "خاصة" : "Private"}</option>
          </select>
        </label>
        <label>
          {ar ? "السعة" : "Capacity"}
          <input name="maxMembers" type="number" min="2" max="25" defaultValue="25" />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button">{ar ? "إنشاء الغرفة" : "Create room"}</button>
    </form>
  );
}
