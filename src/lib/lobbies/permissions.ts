export function canControlTimer(role: string) {
  return role === "OWNER" || role === "MODERATOR";
}
export function canModerate(role: string) {
  return role === "OWNER" || role === "MODERATOR";
}
export function hasCapacity(count: number, max: number) {
  return count < Math.min(25, max);
}
