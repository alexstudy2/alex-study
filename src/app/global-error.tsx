"use client";

import { useEffect, useState } from "react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    if (document.documentElement.lang === "ar" || window.location.pathname.startsWith("/ar")) {
      setTimeout(() => setLang("ar"), 0);
    }
  }, []);

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
