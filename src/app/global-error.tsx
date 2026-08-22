"use client";

import { useEffect, useState } from "react";
import { captureError } from "@/lib/observability/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [lang, setLang] = useState("en");

  /* Report instead of swallowing (audit M5): client-side captureError logs to the
     browser console with scope + digest, which is also what a future client-side
     reporter would attach to. Server errors flow through captureError at their
     throw sites and reach structured stderr. */
  useEffect(() => {
    captureError("global-error", error, { digest: error.digest });
    if (document.documentElement.lang === "ar" || window.location.pathname.startsWith("/ar")) {
      setTimeout(() => setLang("ar"), 0);
    }
  }, [error]);

  const isAr = lang === "ar";

  return (
    <html lang={isAr ? "ar" : "en"} dir={isAr ? "rtl" : "ltr"}>
      <body>
        <main className="launch-state">
          <p className="eyebrow">Alex Study</p>
          <h1>{isAr ? "حدث خطأ غير متوقع." : "Something interrupted this page."}</h1>
          <p>{isAr ? "بياناتك الدراسية المحفوظة لم تتغير. حاول تحميل الصفحة مرة أخرى." : "Your saved study data is unchanged. Try loading the page again."}</p>
          <button className="primary-button" onClick={reset}>
            {isAr ? "حاول مرة أخرى" : "Try again"}
          </button>
        </main>
      </body>
    </html>
  );
}
