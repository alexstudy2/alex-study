import type { Metadata } from "next";
import localFont from "next/font/local";
import { getLocale, getMessages } from "next-intl/server";
import { AppShell } from "@/components/navigation/app-shell";
import { Providers } from "@/components/providers";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import "./globals.css";

const cinzel = localFont({
  src: "../../fonts/Cinzel-VariableFont_wght.ttf",
  variable: "--font-cinzel",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Alex Study",
  title: { default: "Alex Study", template: "%s | Alex Study" },
  description: "Study companion for Alexandria University medical students",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const profile = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          name: true,
          preference: { select: { locale: true, theme: true } },
          _count: { select: { notifications: { where: { readAt: null } } } },
        },
      })
    : null;
  const locale = profile?.preference?.locale.toLowerCase() ?? (await getLocale());
  const messages = await getMessages({ locale });
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={cinzel.variable}
      data-theme={profile?.preference?.theme.toLowerCase() ?? undefined}
    >
      <body className="min-h-full flex flex-col">
        <Providers messages={messages} session={session} locale={locale}>
          <AppShell
            user={
              profile ? { name: profile.name, locale: profile.preference?.locale ?? "EN" } : null
            }
            unreadCount={profile?._count.notifications ?? 0}
            initialTheme={profile?.preference?.theme ?? "SYSTEM"}
          >
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
