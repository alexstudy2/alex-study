import { getSession } from "@/lib/auth/session";

export async function apiUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export function invalid(fields?: unknown) {
  return Response.json({ error: "invalid_request", fields }, { status: 400 });
}
export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
export function notFound() {
  return Response.json({ error: "not_found" }, { status: 404 });
}
