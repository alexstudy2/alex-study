"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { Field, PasswordField, SelectField } from "@/components/auth/fields";
import { academicYearOptions } from "@/components/auth/academic-year";

type Locale = "en" | "ar";

export function SignInForm({
  locale,
  callbackUrl = "/dashboard",
}: {
  locale: Locale;
  callbackUrl?: string;
}) {
  const ar = locale === "ar";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      collegeId: form.get("collegeId"),
      academicYear: form.get("academicYear"),
      password: form.get("password"),
      redirect: false,
    });
    setPending(false);
    if (result?.error) {
      setError(
        ar
          ? "تحقق من الرقم الجامعي والسنة الدراسية وكلمة المرور."
          : "Check your college ID, academic year, and password.",
      );
      return;
    }
    /* Always a relative path (the page sanitises ?callbackUrl before it reaches here), so the
       browser resolves it against the origin we are on rather than against NEXTAUTH_URL. */
    window.location.assign(callbackUrl);
  }

  return (
    /* `method="post"` is hardening, not routing: submitting before hydration would otherwise
       default to GET and write the password into the URL and the browser history. */
    <form onSubmit={submit} method="post" className="auth-form">
      <Field
        name="collegeId"
        label={ar ? "الرقم الجامعي" : "College ID"}
        autoComplete="username"
        placeholder={ar ? "مثال: 20-1234" : "e.g. 20-1234"}
      />
      <SelectField
        name="academicYear"
        label={ar ? "السنة الدراسية" : "Academic year"}
        value="1"
      >
        {academicYearOptions(ar)}
      </SelectField>
      <PasswordField
        name="password"
        label={ar ? "كلمة المرور" : "Password"}
        autoComplete="current-password"
        revealLabel={ar ? "إظهار كلمة المرور" : "Show password"}
        hideLabel={ar ? "إخفاء كلمة المرور" : "Hide password"}
      />
      <p id="signin-error" className="form-error" aria-live="polite">
        {error}
      </p>
      <button
        className="primary-button"
        disabled={pending}
        aria-describedby={error ? "signin-error" : undefined}
      >
        {pending ? (ar ? "جار تسجيل الدخول..." : "Signing in...") : ar ? "تسجيل الدخول" : "Sign in"}
      </button>
    </form>
  );
}
