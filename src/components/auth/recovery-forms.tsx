"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Locale = "en" | "ar";

export function ForgotPasswordForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    setPending(false);
    setMessage(
      response.ok
        ? ar
          ? "إذا كان الحساب مؤهلا، أرسلنا رابط الاستعادة إلى البريد المسجل."
          : "If the account is eligible, a recovery link has been sent to its registered email."
        : ar
          ? "تعذر إرسال الطلب. حاول لاحقا."
          : "The request could not be sent. Try again later.",
    );
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        {ar ? "الرقم الجامعي" : "College ID"}
        <input name="collegeId" autoComplete="username" required />
      </label>
      <p id="forgot-password-message" className="form-feedback" role="status" aria-live="polite">
        {message}
      </p>
      <button className="primary-button" disabled={pending} aria-describedby={message ? "forgot-password-message" : undefined}>
        {pending ? (ar ? "جار الإرسال..." : "Sending...") : ar ? "متابعة" : "Continue"}
      </button>
    </form>
  );
}

export function ManualResetForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const response = await fetch("/api/auth/manual-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    setPending(false);
    if (response.ok) event.currentTarget.reset();
    setMessage(
      response.ok
        ? ar
          ? "تم استلام الطلب للمراجعة."
          : "Your request has been received for review."
        : ar
          ? "راجع البيانات وحاول مرة أخرى."
          : "Review the details and try again.",
    );
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        {ar ? "الرقم الجامعي" : "College ID"}
        <input name="collegeId" autoComplete="username" required />
      </label>
      <label>
        {ar ? "بيانات التحقق" : "Identity details"}
        <textarea
          name="details"
          minLength={20}
          required
          rows={6}
          placeholder={
            ar
              ? "أضف بيانات تساعد مسؤول الكلية على التحقق من الحساب. لا تكتب كلمة المرور."
              : "Add information a college admin can use to verify your account. Do not include your password."
          }
        />
      </label>
      <p id="manual-reset-message" className="form-feedback" role="status" aria-live="polite">
        {message}
      </p>
      <button className="primary-button" disabled={pending} aria-describedby={message ? "manual-reset-message" : undefined}>
        {pending ? (ar ? "جار الإرسال..." : "Sending...") : ar ? "إرسال الطلب" : "Send request"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token, locale }: { token: string; locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmation")) {
      setMessage(ar ? "كلمتا المرور غير متطابقتين." : "The passwords do not match.");
      return;
    }
    setPending(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password: form.get("password") }),
    });
    setPending(false);
    if (!response.ok) {
      setMessage(
        ar ? "الرابط غير صالح أو انتهت صلاحيته." : "The recovery link is invalid or has expired.",
      );
      return;
    }
    router.push("/sign-in?reset=1");
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        {ar ? "كلمة المرور الجديدة" : "New password"}
        <input
          name="password"
          type="password"
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        {ar ? "تأكيد كلمة المرور" : "Confirm password"}
        <input
          name="confirmation"
          type="password"
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
      <p id="reset-password-message" className="form-error" role="alert" aria-live="polite">
        {message}
      </p>
      <button className="primary-button" disabled={pending} aria-describedby={message ? "reset-password-message" : undefined}>
        {pending
          ? ar
            ? "جار التحديث..."
            : "Updating..."
          : ar
            ? "تحديث كلمة المرور"
            : "Update password"}
      </button>
    </form>
  );
}

export function ManualResetLink({ locale }: { locale: Locale }) {
  return (
    <p className="fine-print">
      {locale === "ar"
        ? "إذا لم تضف بريدا للاستعادة، أرسل "
        : "If you did not add a recovery email, submit a "}
      <Link href="/manual-reset">
        {locale === "ar" ? "طلب استعادة يدوي" : "manual reset request"}
      </Link>
      {locale === "ar" ? " لمراجعة مسؤول الكلية." : " for college admin review."}
    </p>
  );
}
