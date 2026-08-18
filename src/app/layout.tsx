import type { Metadata, Viewport } from "next";
import { Delius_Swash_Caps, Delius, JetBrains_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";
import { AppShell } from "@/components/navigation/app-shell";
import { StudyBackground } from "@/components/ui/study-background";
import { moodFromEnum } from "@/lib/settings/study-mood";
import { Providers } from "@/components/providers";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import "./globals.css";

const deliusSwashCaps = Delius_Swash_Caps({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-delius",
  display: "swap",
});

const deliusBody = Delius({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-delius-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  applicationName: "Alex Study",
  title: { default: "Alex Study", template: "%s | Alex Study" },
  description: "Playful, calm study companion for Alexandria University medical students",
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
          preference: { select: { locale: true, studyMood: true } },
          _count: { select: { notifications: { where: { readAt: null } } } },
        },
      })
    : null;
  const locale = profile?.preference?.locale.toLowerCase() ?? (await getLocale());
  const messages = await getMessages({ locale });
  /* Rendered onto <html> so the correct palette is in the very first paint. Reading it
     from localStorage after hydration is what caused the flash of the wrong theme. */
  const mood = moodFromEnum(profile?.preference?.studyMood);
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${deliusSwashCaps.variable} ${deliusBody.variable} ${jetbrainsMono.variable} ${ibmPlexArabic.variable}`}
      data-mood={mood}
    >
      <body className="min-h-full flex flex-col relative">
        <StudyBackground initialMood={mood} />
        <Providers messages={messages} session={session} locale={locale}>
          <AppShell
            user={
              profile ? { name: profile.name, locale: profile.preference?.locale ?? "EN" } : null
            }
            unreadCount={profile?._count.notifications ?? 0}
            initialMood={mood}
          >
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
