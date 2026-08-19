/**
 * One bilingual vocabulary for every failure the AI Exam Plan can return, used by the create wizard
 * and by the proposal editor.
 *
 * This file exists because of a real bug: the wizard mapped three error codes and fell through to
 * "Could not generate an exam plan." for everything else, so a 400 that named the exact field at
 * fault -- `syllabusText` needing 20 characters when the Next button accepted one -- reached the
 * student as a shrug. Rate limits, an unsafe exam date, a busy job and every AI failure read the
 * same way. Nothing here is clever; the point is that no code falls through silently again.
 */

export type ExamPlanErrorPayload = {
  error?: string;
  fields?: Record<string, string[] | undefined> | null;
  retryAfterSeconds?: number;
};

const CODES_EN: Record<string, string> = {
  invalid_request: "Some details need a second look.",
  ai_disabled: "The AI assistant is switched off in your privacy settings.",
  exam_too_soon: "Pick an exam date at least a day away — there is no plan to build for tonight.",
  exam_too_far: "That exam is more than a year away. Pick a nearer date.",
  ai_in_progress: "This plan is still being written. Give it a moment.",
  ai_rate_limited: "You have used today's AI allowance. It resets tomorrow.",
  ai_budget_exhausted: "Today's AI budget is used up. Try again tomorrow.",
  ai_unavailable: "The AI service is not configured on this server.",
  empty_ai_response: "The model returned nothing. Press generate again.",
  invalid_ai_response: "The model's answer could not be read. Press generate again.",
  invalid_ai_plan:
    "The model could not fit your syllabus into these days. Raise the daily study time, remove a rest day, or trim a few topics.",
  ai_request_failed: "The AI service did not answer. Try again in a minute.",
  vision_unavailable: "Photo scanning is not available right now — type your topics instead.",
  nothing_read: "No topics could be read from that photo. Try a sharper, straighter shot.",
  plan_locked: "This proposal is closed.",
  period_too_long: "This plan spans more than 60 days, which is too long for a forum board.",
  no_items: "There is nothing left in this plan to publish.",
  not_found: "This plan no longer exists.",
  invalid_item_date: "Every study date must fall between today and the exam.",
  invalid_subject: "One of the selected courses is not available.",
  accepted_item_locked: "An item that became a task can no longer be edited.",
  exam_date_locked: "The exam date locks once the first task is created.",
  item_not_found: "One selected item no longer belongs to this plan.",
  server_error: "Something went wrong on the server. Try again.",
};

const CODES_AR: Record<string, string> = {
  invalid_request: "بعض البيانات تحتاج مراجعة.",
  ai_disabled: "مساعد الذكاء الاصطناعي معطّل في إعدادات الخصوصية.",
  exam_too_soon: "اختر تاريخ امتحان بعد يوم على الأقل، فلا خطة تُبنى لليلة واحدة.",
  exam_too_far: "الامتحان أبعد من سنة. اختر تاريخًا أقرب.",
  ai_in_progress: "ما زالت الخطة تُكتب. أعطها لحظة.",
  ai_rate_limited: "استهلكت حد الذكاء الاصطناعي لليوم، ويتجدد غدًا.",
  ai_budget_exhausted: "انتهت ميزانية الذكاء الاصطناعي لليوم. حاول غدًا.",
  ai_unavailable: "خدمة الذكاء الاصطناعي غير مُهيّأة على هذا الخادم.",
  empty_ai_response: "لم يُرجع الموديل شيئًا. اضغط توليد مرة أخرى.",
  invalid_ai_response: "تعذّر قراءة رد الموديل. اضغط توليد مرة أخرى.",
  invalid_ai_plan:
    "لم يتمكّن الموديل من توزيع منهجك على هذه الأيام. ارفع وقت الدراسة اليومي، أو ألغِ يوم راحة، أو اختصر بعض الموضوعات.",
  ai_request_failed: "لم تستجب خدمة الذكاء الاصطناعي. حاول بعد دقيقة.",
  vision_unavailable: "قراءة الصور غير متاحة حاليًا — اكتب الموضوعات بنفسك.",
  nothing_read: "لم نتمكّن من قراءة موضوعات من الصورة. جرّب صورة أوضح وأكثر استقامة.",
  plan_locked: "هذا المقترح مغلق.",
  period_too_long: "الخطة تمتد أكثر من ٦٠ يومًا، وهذا أطول من لوحة المنتدى.",
  no_items: "لا يوجد ما يُنشر في هذه الخطة.",
  not_found: "هذه الخطة لم تعد موجودة.",
  invalid_item_date: "يجب أن تكون كل المواعيد بين اليوم والامتحان.",
  invalid_subject: "إحدى المواد المختارة غير متاحة.",
  accepted_item_locked: "لا يمكن تعديل عنصر تحوّل إلى مهمة.",
  exam_date_locked: "يُقفل تاريخ الامتحان بعد إنشاء أول مهمة.",
  item_not_found: "أحد العناصر المحددة لم يعد ضمن الخطة.",
  server_error: "حدث خطأ في الخادم. حاول مرة أخرى.",
};

/**
 * Field-level messages, keyed by the names the zod schemas use.
 *
 * The API already returns `{error:"invalid_request", fields}` -- the wizard simply threw it away.
 * These are written per field rather than passed through from zod because zod's messages are English
 * only, and an Arabic-speaking student should not be shown "String must contain at least 20
 * character(s)". An unknown field falls back to zod's own text, which is better than nothing.
 */
const FIELDS_EN: Record<string, string> = {
  title: "Give the plan a title.",
  examAt: "Pick the exam date.",
  topics: "Add at least one topic, or paste your syllabus as text.",
  syllabusText: "Write at least 20 characters of syllabus, or add topic rows instead.",
  dailyCapacityMinutes: "Daily study time must be between 30 and 600 minutes.",
  restDays: "Keep at least one day free for studying.",
  image: "Use a PNG, JPEG or WebP photo under 4 MB.",
  itemIds: "Select at least one item first.",
  plannedDate: "Every study date must fall between today and the exam.",
};

const FIELDS_AR: Record<string, string> = {
  title: "اكتب عنوانًا للخطة.",
  examAt: "اختر تاريخ الامتحان.",
  topics: "أضف موضوعًا واحدًا على الأقل، أو الصق المنهج كنص.",
  syllabusText: "اكتب ٢٠ حرفًا على الأقل من المنهج، أو أضف موضوعات في صفوف.",
  dailyCapacityMinutes: "وقت الدراسة اليومي بين ٣٠ و ٦٠٠ دقيقة.",
  restDays: "اترك يومًا واحدًا على الأقل للدراسة.",
  image: "استخدم صورة PNG أو JPEG أو WebP أقل من ٤ ميجابايت.",
  itemIds: "اختر عنصرًا واحدًا على الأقل.",
  plannedDate: "يجب أن تكون كل المواعيد بين اليوم والامتحان.",
};

/** The offending field names, in the order the API listed them. Empty when the failure is not a 400. */
export function examPlanErrorFields(payload: ExamPlanErrorPayload | null | undefined) {
  if (!payload?.fields) return [];
  return Object.entries(payload.fields)
    .filter(([, messages]) => messages?.length)
    .map(([field]) => field);
}

export function examPlanErrorMessage(
  payload: ExamPlanErrorPayload | null | undefined,
  ar: boolean,
) {
  const codes = ar ? CODES_AR : CODES_EN;
  const fields = ar ? FIELDS_AR : FIELDS_EN;
  const code = payload?.error ?? "server_error";

  if (code === "invalid_request" && payload?.fields) {
    const messages = Object.entries(payload.fields).flatMap(([field, list]) =>
      list?.length ? [fields[field] ?? list[0]] : [],
    );
    if (messages.length) return [...new Set(messages)].join(" ");
  }
  if (code === "rate_limited") {
    const seconds = payload?.retryAfterSeconds;
    if (ar)
      return seconds
        ? `طلبات كثيرة بسرعة. حاول بعد ${seconds} ثانية.`
        : "طلبات كثيرة بسرعة. انتظر قليلًا.";
    return seconds
      ? `Too many requests. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`
      : "Too many requests. Wait a moment and try again.";
  }
  return codes[code] ?? codes.server_error;
}

/** Was that a network failure rather than a reply? Both callers say the same thing about it. */
export function examPlanOfflineMessage(ar: boolean) {
  return ar ? "تعذّر الوصول إلى الخادم. حاول مرة أخرى." : "The server could not be reached. Try again.";
}
