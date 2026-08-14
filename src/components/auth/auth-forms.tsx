"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Locale = "en" | "ar";

export function SignInForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
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
    if (result?.error)
      setError(
        ar
          ? "تحقق من الرقم الجامعي والسنة الدراسية وكلمة المرور."
          : "Check your college ID, academic year, and password.",
      );
    else router.push("/dashboard");
  }
  return (
    <form onSubmit={submit} className="auth-form">
      <Field name="collegeId" label={ar ? "الرقم الجامعي" : "College ID"} autoComplete="username" />
      <label>
        {ar ? "السنة الدراسية" : "Academic year"}
        <select name="academicYear" defaultValue="1">
          {[1, 2, 3, 4, 5, 6].map((year) => (
            <option key={year} value={year}>
              {ar
                ? year === 6
                  ? "سنة الامتياز (Internship)"
                  : `السنة ${year}`
                : year === 6
                  ? "Internship (Intern)"
                  : `Year ${year}`}
            </option>
          ))}
        </select>
      </label>
      <Field
        name="password"
        label={ar ? "كلمة المرور" : "Password"}
        type="password"
        autoComplete="current-password"
      />
      <p className="form-error" aria-live="polite">
        {error}
      </p>
      <button className="primary-button" disabled={pending}>
        {pending ? (ar ? "جار تسجيل الدخول..." : "Signing in...") : ar ? "تسجيل الدخول" : "Sign in"}
      </button>
    </form>
  );
}

export function RegisterForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    setPending(false);
    if (!response.ok) {
      setError(
        response.status === 409
          ? ar
            ? "الرقم الجامعي أو البريد مستخدم بالفعل."
            : "This college ID or email is already registered."
          : ar
            ? "راجع البيانات وحاول مرة أخرى."
            : "Please review the form and try again.",
      );
      return;
    }
    document.cookie = `alex-study-locale=${String(form.get("locale")).toLowerCase()}; path=/; max-age=31536000; samesite=lax`;
    router.push("/sign-in?registered=1");
  }
  return (
    <form onSubmit={submit} className="auth-form">
      <Field name="name" label={ar ? "الاسم الكامل" : "Full name"} autoComplete="name" />
      <Field name="collegeId" label={ar ? "الرقم الجامعي" : "College ID"} autoComplete="username" />
      <label>
        {ar ? "السنة الدراسية" : "Academic year"}
        <select name="academicYear" defaultValue="1">
          {[1, 2, 3, 4, 5, 6].map((year) => (
            <option key={year} value={year}>
              {ar
                ? year === 6
                  ? "سنة الامتياز (Internship)"
                  : `السنة ${year}`
                : year === 6
                  ? "Internship (Intern)"
                  : `Year ${year}`}
            </option>
          ))}
        </select>
      </label>
      <Field
        name="email"
        label={ar ? "بريد الاستعادة (اختياري)" : "Recovery email (optional)"}
        type="email"
        autoComplete="email"
        required={false}
      />
      <Field
        name="password"
        label={ar ? "كلمة المرور" : "Password"}
        type="password"
        autoComplete="new-password"
      />
      <label>
        {ar ? "اللغة" : "Language"}
        <select name="locale" defaultValue={ar ? "AR" : "EN"}>
          <option value="EN">English</option>
          <option value="AR">العربية</option>
        </select>
      </label>
      <p className="form-error" aria-live="polite">
        {error}
      </p>
      <button className="primary-button" disabled={pending}>
        {pending
          ? ar
            ? "جار إنشاء الحساب..."
            : "Creating account..."
          : ar
            ? "إنشاء الحساب"
            : "Create account"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} autoComplete={autoComplete} required={required} />
    </label>
  );
}
