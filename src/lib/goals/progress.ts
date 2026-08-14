export type GoalProgressInput = {
  metric: string;
  targetValue: number;
  studySeconds?: number | null;
  tasksCompleted?: number | null;
};

export function calculateGoalProgress(input: GoalProgressInput) {
  const currentValue =
    input.metric === "STUDY_MINUTES"
      ? Math.floor((input.studySeconds ?? 0) / 60)
      : (input.tasksCompleted ?? 0);
  return {
    currentValue,
    percentage: Math.min(100, Math.round((currentValue / Math.max(1, input.targetValue)) * 100)),
    complete: currentValue >= input.targetValue,
  };
}

export function daysRemaining(deadline: Date, now = new Date()) {
  return Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
}
