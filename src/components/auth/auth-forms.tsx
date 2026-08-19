/**
 * Compatibility barrel.
 *
 * Both forms used to live here in one 177-line file. They now live in sign-in-form.tsx and
 * sign-up-wizard.tsx (with the shared inputs in fields.tsx), and this file exists so that
 * `@/components/auth/auth-forms` keeps resolving -- including for anything outside the repo's
 * own import graph, like a bookmarked audit script.
 *
 * `RegisterForm` is the old name for what is now a three-step wizard; the alias keeps the
 * rename from becoming a breaking change for callers.
 */
export { SignInForm } from "@/components/auth/sign-in-form";
export { SignUpWizard, SignUpWizard as RegisterForm } from "@/components/auth/sign-up-wizard";
