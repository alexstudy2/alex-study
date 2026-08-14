"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ConsentChoice({ locale }: { locale: "en" | "ar" }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function choose(accepted: boolean) {
    setPending(true);
    setError("");
    const response = await fetch("/api/me/consent", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accepted }),
    });
    setPending(false);
    if (!response.ok) {
      setError(
        ar ? "تعذر حفظ الاختيار. حاول مرة أخرى." : "The choice could not be saved. Try again.",
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }
  return (
    <div>
      <div className="choice-row">
        <button className="primary-button" disabled={pending} onClick={() => void choose(true)}>
          {ar ? "السماح بالتحليلات الشخصية" : "Allow personal analytics"}
        </button>
        <button className="secondary-button" disabled={pending} onClick={() => void choose(false)}>
          {ar ? "المتابعة دون تحليلات" : "Continue without analytics"}
        </button>
      </div>
      <p className="form-error" role="alert" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
