import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { credentialsSchema } from "@/lib/auth/validation";

export const authOptions: NextAuthOptions = {
  /* Explicit instead of the v4 default: the 30-day lifetime is now a documented choice
     that pairs with server-side revocation (sessionVersion) rather than an accident of
     omission -- a stolen cookie dies at the next password change even within this window. */
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/sign-in" },
  /* Left to next-auth this is inferred from whether NEXTAUTH_URL starts with https://
     (core/init.js), so a stale localhost value in a hosted environment silently drops the
     __Secure- cookie prefix and the `secure` flag on the session cookie. Deciding it from
     NODE_ENV instead keeps that guarantee independent of a hand-maintained URL.
     Caveat: serving a production build over plain HTTP locally will not keep a session. */
  useSecureCookies: process.env.NODE_ENV === "production",
  providers: [
    CredentialsProvider({
      name: "College ID",
      credentials: {
        collegeId: { label: "College ID", type: "text" },
        academicYear: { label: "Academic Year", type: "number" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findFirst({
          where: {
            collegeId: parsed.data.collegeId.toUpperCase(),
            academicYear: parsed.data.academicYear,
          },
          include: { preference: true },
        });
        if (!user || !(await compare(parsed.data.password, user.passwordHash))) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          collegeId: user.collegeId,
          academicYear: user.academicYear,
          role: user.role,
          locale: user.preference?.locale ?? "EN",
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Keep every redirect on the deployment's own origin, and keep it absolute.
     *
     * Absolute matters more than it looks: `signIn()` runs `new URL(data.url)` with no base
     * (next-auth/react/index.js:267) on the JSON the credentials callback returns, so a
     * relative value there throws `Failed to construct 'URL': Invalid URL` and takes the
     * sign-in with it. So same-origin is enforced here, not relativised.
     *
     * `baseUrl` is next-auth's own idea of the origin, derived from NEXTAUTH_URL before it
     * ever looks at the forwarded host (utils/detect-origin.js) -- which is why the three
     * sign-out call sites do not rely on this callback at all: they pass `redirect: false`
     * and navigate to a relative path themselves, so the browser resolves it against the
     * origin the user is actually on. See the note in components/navigation/app-shell.tsx.
     */
    async redirect({ url, baseUrl }) {
      try {
        const target = new URL(url, baseUrl);
        if (target.origin === new URL(baseUrl).origin) return target.toString();
      } catch {
        // Unparseable target: fall through to the safe default below.
      }
      return baseUrl;
    },
    async jwt({ token, user, trigger, session }) {
      if (user)
        Object.assign(token, {
          id: user.id,
          collegeId: user.collegeId,
          academicYear: user.academicYear,
          role: user.role,
          locale: user.locale,
          /* The revocation counter this cookie was issued against. apiUser() compares it
             with the database on every request; a bump on password reset strands this
             value and the cookie stops working. */
          sv: user.sessionVersion,
        });
      if (trigger === "update" && session) {
        if (session.locale === "EN" || session.locale === "AR") token.locale = session.locale;
        if (typeof session.name === "string" && session.name.trim())
          token.name = session.name.trim();
        if (typeof session.academicYear === "number") token.academicYear = session.academicYear;
        if (typeof session.email === "string" || session.email === null)
          token.email = session.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user)
        Object.assign(session.user, {
          id: token.id,
          collegeId: token.collegeId,
          academicYear: token.academicYear,
          role: token.role,
          locale: token.locale,
          /* Server-side only: apiUser() reads this to verify against User.sessionVersion.
             Harmless if a curious client sees it -- it is just a counter. */
          sv: typeof token.sv === "number" ? token.sv : undefined,
        });
      return session;
    },
  },
};
