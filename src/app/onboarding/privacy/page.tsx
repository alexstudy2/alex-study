import { ConsentChoice } from "@/components/onboarding/consent-choice";
import { requireUser } from "@/lib/auth/session";

export default async function PrivacyOnboardingPage() {
  const user = await requireUser();
  const ar = user.locale === "AR";
  return (
    /* A standalone page outside both the student frame and the (auth) group, so it wears the
       front door's vocabulary directly: the graph-paper panel and doodle card from auth.css,
       centred as a single card. All of its styling lives in shell.css/auth.css -- none of the
       Tailwind margin or heading utilities survive this app's unlayered cascade. */
    <main className="onboarding-shell" dir={ar ? "rtl" : "ltr"}>
      <div className="auth-content">
        <p className="eyebrow">{ar ? "اختيار واضح" : "One clear choice"}</p>
        <h1>{ar ? "هل تساعدنا في تحسين تجربة دراستك؟" : "Help improve your study experience?"}</h1>
        <p className="auth-subtitle">
          {ar
            ? "يستخدم Alex Study نشاط مهامك وجلساتك فقط لحساب الاستمرارية واتجاهات التركيز والرؤى الداعمة. لا يظهر الرقم الجامعي في التحليلات أو لوحات المتصدرين."
            : "Alex Study uses your own task and session activity to calculate streaks, focus trends, and supportive insights. College IDs are never shown in analytics or leaderboards."}
        </p>
        <ConsentChoice locale={ar ? "ar" : "en"} />
      </div>
    </main>
  );
}
