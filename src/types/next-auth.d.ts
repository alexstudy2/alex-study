import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User { collegeId: string; academicYear: number; role: string; locale: "EN" | "AR" }
  interface Session { user: { id: string; collegeId: string; academicYear: number; role: string; locale: "EN" | "AR"; name?: string | null; email?: string | null; image?: string | null } }
}
declare module "next-auth/jwt" {
  interface JWT { id: string; collegeId: string; academicYear: number; role: string; locale: "EN" | "AR" }
}
