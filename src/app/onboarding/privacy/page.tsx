import { ConsentChoice } from "@/components/onboarding/consent-choice";
import { requireUser } from "@/lib/auth/session";

export default async function PrivacyOnboardingPage() {
  const user = await requireUser();
  const ar = user.locale === "AR";
  return (
    <main className="page-shell narrow" dir={ar ? "rtl" : "ltr"}>
      <p className="eyebrow">{ar ? "اختيار واضح" : "One clear choice"}</p>
      <h1>{ar ? "هل تساعدنا في تحسين تجربة دراستك؟" : "Help improve your study experience?"}</h1>
      <p>
        {ar
          ? "يستخدم Alex Study نشاط مهامك وجلساتك فقط لحساب الاستمرارية واتجاهات التركيز والرؤى الداعمة. لا يظهر الرقم الجامعي في التحليلات أو لوحات المتصدرين."
          : "Alex Study uses your own task and session activity to calculate streaks, focus trends, and supportive insights. College IDs are never shown in analytics or leaderboards."}
      </p>
      <ConsentChoice locale={ar ? "ar" : "en"} />
    </main>
  );
}
