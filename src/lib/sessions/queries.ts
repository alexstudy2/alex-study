export const timerRunInclude = {
  task: { select: { id: true, title: true } },
  subject: { select: { id: true, name: true, colorToken: true } },
  session: { select: { id: true, distractionCount: true } },
};

export const sessionInclude = {
  task: { select: { id: true, title: true } },
  subject: { select: { id: true, name: true, colorToken: true } },
  distractions: { orderBy: { occurredAt: "asc" as const } },
};
