export function goalStatusLabel(status: string, locale: "en" | "ar") {
  const arabic: Record<string, string> = {
    ACTIVE: "نشط",
    COMPLETED: "مكتمل",
    CANCELLED: "ملغى",
  };
  const english: Record<string, string> = {
    ACTIVE: "Active",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return (locale === "ar" ? arabic : english)[status] ?? status;
}

export function sessionSourceLabel(source: string, locale: "en" | "ar") {
  const arabic: Record<string, string> = {
    MANUAL: "يدوي",
    TIMER: "مؤقت",
    LOBBY: "غرفة",
  };
  const english: Record<string, string> = {
    MANUAL: "Manual",
    TIMER: "Timer",
    LOBBY: "Lobby",
  };
  return (locale === "ar" ? arabic : english)[source] ?? source;
}

export function notificationTypeLabel(type: string, locale: "en" | "ar") {
  const arabic: Record<string, string> = {
    FRIEND_REQUEST: "طلب صداقة",
    FRIEND_ACCEPTED: "تم قبول الصداقة",
    ACCOUNTABILITY_INVITE: "دعوة للمساءلة",
    ACCOUNTABILITY_ACCEPTED: "تم قبول دعوة المساءلة",
    ACCOUNTABILITY_REMINDER: "تذكير المساءلة",
    CHALLENGE_INVITE: "دعوة تحدي",
    CHALLENGE_STARTED: "بدأ التحدي",
    CHALLENGE_ENDED: "انتهى التحدي",
    NEW_LOBBY_INVITE: "دعوة لغرفة تركيز",
  };
  const english: Record<string, string> = {
    FRIEND_REQUEST: "Friend request",
    FRIEND_ACCEPTED: "Friend accepted",
    ACCOUNTABILITY_INVITE: "Accountability invite",
    ACCOUNTABILITY_ACCEPTED: "Accountability accepted",
    ACCOUNTABILITY_REMINDER: "Accountability reminder",
    CHALLENGE_INVITE: "Challenge invite",
    CHALLENGE_STARTED: "Challenge started",
    CHALLENGE_ENDED: "Challenge ended",
    NEW_LOBBY_INVITE: "Lobby invite",
  };
  return (locale === "ar" ? arabic : english)[type] ?? type.replaceAll("_", " ");
}

export function friendshipStatusLabel(status: string, locale: "en" | "ar") {
  const arabic: Record<string, string> = {
    PENDING: "قيد الانتظار",
    ACTIVE: "نشط",
    PAUSED: "متوقف مؤقتًا",
  };
  const english: Record<string, string> = {
    PENDING: "Pending",
    ACTIVE: "Active",
    PAUSED: "Paused",
  };
  return (locale === "ar" ? arabic : english)[status] ?? status;
}
