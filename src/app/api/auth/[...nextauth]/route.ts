import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { authRateLimit, enforceRateLimit } from "@/lib/http/rate-limit";

const handler = NextAuth(authOptions);
export { handler as GET };

export async function POST(...args: Parameters<typeof handler>) {
  const request = args[0] as Request;
  if (new URL(request.url).pathname.endsWith("/callback/credentials")) {
    const limited = await enforceRateLimit(request, authRateLimit);
    if (limited) return limited;
  }
  return handler(...args);
}
