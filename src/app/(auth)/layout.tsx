import Link from "next/link";
import { getLocale } from "next-intl/server";
import { BookOpenCheck, Timer, Users } from "lucide-react";
import { AlexStudyLogo } from "@/components/ui/logo";
import { MOOD_SWATCH, STUDY_MOOD_IDS } from "@/lib/settings/study-mood";

/* One lookup rather than a ternary per string. Same shape settings-workspace.tsx uses --
   no component in this repo reads next-intl messages, and the front door is not the place
   to become the exception. */
const COPY = {
  en: {
    eyebrow: "Faculty of Medicine · Alexandria University",
    headlineLead: "Study with",
    headlineAccent: "clarity.",
    headlineTail: "Grow with your class.",
    lede: "A focused, supportive study space built exclusively for Alexandria medical students.",
    points: [
      "Pomodoro timers tuned to your own rhythm",
      "Exam plans built from your syllabus",
      "Study rooms and streaks with your batch",
    ],
    ribbon: "Five study moods — pick yours as you sign up",
  },
  ar: {
    eyebrow: "كلية الطب · جامعة الإسكندرية",
    headlineLead: "ادرس",
    headlineAccent: "بوضوح.",
    headlineTail: "وتقدم مع دفعتك.",
    lede: "مساحة دراسة هادئة وداعمة صممت لطلاب طب الإسكندرية.",
    points: [
      "مؤقت بومودورو على إيقاعك الخاص",
      "خطط امتحانات مبنية من المنهج",
      "غرف مذاكرة وسلاسل إنجاز مع دفعتك",
    ],
    ribbon: "خمس أجواء للمذاكرة — اختر جوك عند التسجيل",
  },
} as const;

const POINT_ICONS = [Timer, BookOpenCheck, Users];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const ar = (await getLocale()) === "ar";
  const copy = ar ? COPY.ar : COPY.en;
  return (
    <main className="auth-shell" dir={ar ? "rtl" : "ltr"}>
      <section className="auth-brand">
        <div className="auth-brand-inner">
          <p className="eyebrow">{copy.eyebrow}</p>
          <Link href="/" className="wordmark">
            <AlexStudyLogo size={42} />
          </Link>
          <h1 className="auth-headline">
            {copy.headlineLead} <em>{copy.headlineAccent}</em>
            <br />
            {copy.headlineTail}
          </h1>
          <p className="auth-brand-lede">{copy.lede}</p>
          <ul className="auth-brand-points">
            {copy.points.map((point, index) => {
              const Icon = POINT_ICONS[index];
              return (
                <li key={point} className="auth-brand-point">
                  <span className="auth-brand-point-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span>{point}</span>
                </li>
              );
            })}
          </ul>
          <div className="auth-mood-ribbon">
            <span className="auth-mood-ribbon-dots" aria-hidden="true">
              {STUDY_MOOD_IDS.map((mood) => (
                <span
                  key={mood}
                  className="auth-mood-ribbon-dot"
                  style={{ background: MOOD_SWATCH[mood] }}
                />
              ))}
            </span>
            <span className="auth-mood-ribbon-caption">{copy.ribbon}</span>
          </div>
        </div>
        {/* Decoration only: clipped by .auth-brand's overflow, hidden below 860px, and never
            announced. Drawn rather than imported so it inherits the mood ink colour. */}
        <span className="auth-brand-doodle" aria-hidden="true">
          <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2.4">
            <circle cx="60" cy="60" r="44" strokeDasharray="9 11" strokeLinecap="round" />
            <path d="M42 62c6-14 16-20 26-12s2 24-8 22-12-16-2-22 22 2 26 14" strokeLinecap="round" />
          </svg>
          <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M18 92c14-6 22-30 18-52" strokeLinecap="round" />
            <path d="M36 40c14 4 30-2 40-16" strokeLinecap="round" />
            <path d="M64 78l6-14 14-6-14-6-6-14-6 14-14 6 14 6z" strokeLinejoin="round" />
            <circle cx="96" cy="34" r="6" />
          </svg>
        </span>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
