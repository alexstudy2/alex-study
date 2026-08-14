import type { Challenge } from "@/components/challenges/types";

type Locale = "en" | "ar";

export function challengeUnit(type: Challenge["type"], value: number, locale: Locale) {
  const tasks = type.includes("TASK_COUNT");
  if (locale === "ar") return tasks ? "مهمة مؤهلة" : "دقيقة مؤهلة";
  if (tasks) return value === 1 ? "eligible task" : "eligible tasks";
  return value === 1 ? "eligible minute" : "eligible minutes";
}

export function challengeTypeLabel(type: Challenge["type"], locale: Locale) {
  const labels = {
    TASK_COUNT: locale === "ar" ? "عدد المهام" : "Task count",
    STUDY_TIME: locale === "ar" ? "وقت الدراسة" : "Study time",
    SUBJECT_TASK_COUNT: locale === "ar" ? "مهام مادة" : "Subject tasks",
    SUBJECT_STUDY_TIME: locale === "ar" ? "وقت مادة" : "Subject study time",
  };
  return labels[type];
}

export function resolutionLabel(type: Challenge["resolutionType"], locale: Locale) {
  if (type === "TARGET_FIRST") return locale === "ar" ? "الأول إلى الهدف" : "First to target";
  return locale === "ar" ? "المتصدر عند الموعد" : "Leader at deadline";
}

export function statusLabel(status: string, locale: Locale) {
  const english: Record<string, string> = {
    PENDING: "Awaiting response",
    SCHEDULED: "Scheduled",
    ACTIVE: "In progress",
    COMPLETED: "Complete",
    DECLINED: "Declined",
    CANCELLED: "Cancelled",
    EXPIRED: "Closed without a winner",
  };
  const arabic: Record<string, string> = {
    PENDING: "بانتظار الرد",
    SCHEDULED: "مجدول",
    ACTIVE: "جارٍ",
    COMPLETED: "مكتمل",
    DECLINED: "مرفوض",
    CANCELLED: "ملغي",
    EXPIRED: "انتهى بلا فائز",
  };
  return (locale === "ar" ? arabic : english)[status] ?? status;
}

export function formatDate(value: string | Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  }).format(new Date(value));
}

export function challengeOpponent(challenge: Challenge, userId: string) {
  return challenge.creatorId === userId ? challenge.opponent : challenge.creator;
}

export function badgeCopy(
  key: string,
  locale: Locale,
  fallback: { name: string; description: string },
) {
  if (locale === "en") return fallback;
  const arabic: Record<string, { name: string; description: string }> = {
    CHALLENGE_FINISHER: {
      name: "إكمال التحدي",
      description: "أكملت تحديًا فرديًا مقبولًا.",
    },
    CHALLENGE_WINNER: {
      name: "إنجاز التحدي",
      description: "أنهيت تحديًا بالنتيجة المؤهلة المتقدمة.",
    },
    TARGET_REACHED: {
      name: "الوصول إلى الهدف",
      description: "وصلت إلى الهدف المتفق عليه.",
    },
    CONSISTENT_CHALLENGER: {
      name: "ثبات في التحديات",
      description: "أكملت خمسة تحديات فردية مقبولة.",
    },
  };
  return arabic[key] ?? fallback;
}
