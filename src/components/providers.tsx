"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";

export function Providers({
  children,
  messages,
  session,
  locale,
}: {
  children: React.ReactNode;
  messages: Record<string, unknown>;
  session: Session | null;
  locale: string;
}) {
  return (
    <SessionProvider session={session}>
      <NextIntlClientProvider messages={messages} locale={locale}>
        {children}
      </NextIntlClientProvider>
    </SessionProvider>
  );
}
