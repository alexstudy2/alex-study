import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { credentialsSchema } from "@/lib/auth/validation";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user)
        Object.assign(token, {
          id: user.id,
          collegeId: user.collegeId,
          academicYear: user.academicYear,
          role: user.role,
          locale: user.locale,
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
        });
      return session;
    },
  },
};
