import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    collegeId: string;
    academicYear: number;
    role: string;
    locale: "EN" | "AR";
    /** Copied from the User row at sign-in and stamped into the JWT as `sv`. */
    sessionVersion: number;
  }
  interface Session {
    user: {
      id: string;
      collegeId: string;
      academicYear: number;
      role: string;
      locale: "EN" | "AR";
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /**
       * The session version this JWT was issued against. Exposed only so server-side
       * helpers can compare it against the database; clients have no use for it.
       */
      sv?: number;
    }
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    collegeId: string;
    academicYear: number;
    role: string;
    locale: "EN" | "AR";
    /** Server-side revocation counter -- see User.sessionVersion and apiUser(). */
    sv?: number;
  }
}
