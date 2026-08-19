import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, IBM_Plex_Sans, Amiri, Cairo, Fraunces } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";
import { AppShell } from "@/components/navigation/app-shell";
import { StudyBackground } from "@/components/ui/study-background";
import { moodFromEnum } from "@/lib/settings/study-mood";
import { Providers } from "@/components/providers";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import "./globals.css";

/* Five families, all self-hosted: next.config.ts sets CSP `font-src 'self' data:`, so a Google
   CDN stylesheet would be blocked outright. Which token each one fills, and why these five,
   is documented in the Fonts block of src/styles/tokens.css. */

/* Body, labels, controls. No `weight` on purpose -- that pulls the variable font, so the app's
   400/700/800 declarations interpolate off one file instead of downloading three. */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

/* Arabic body, labels and controls -- the RTL counterpart to IBM Plex Sans. Cairo is a variable
   humanist Arabic (wght 200-1000), so like Plex it interpolates every weight the UI asks for off a
   single file; omitting `weight` is what pulls that variable cut. It keeps the token name
   --font-arabic, so every chain in tokens.css that splices Arabic in is untouched -- only the face
   behind the name moved off IBM Plex Sans Arabic, which the user asked to retire site-wide. */
const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
});

/* Arabic headings and the auth headlines -- the RTL counterpart to Fraunces. Amiri is a classic
   high-contrast Naskh, the same calligraphic, high-contrast character the serif brings to Latin,
   which is what the display chains want when the heading is Arabic. It has no variable cut, so the
   two weights the headings actually hit are named explicitly (700 display, 400 elsewhere). Italic
   is deliberately omitted: Arabic does not slant, and auth.css sets the RTL headline `em` back to
   upright rather than letting the browser synthesise a slant. */
const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-arabic-display",
  display: "swap",
});

/* Every heading in the app, and the auth headlines. `axes` is what keeps the interesting parts
   of the variable font in the file: opsz drives automatic optical sizing, which matters because
   this one token is used from 14px labels to 40px display sizes; SOFT and WONK are the axes the
   auth pages lean on (see .auth-headline in auth.css) and are left at their defaults elsewhere,
   so the app reads as a clean serif rather than a quirky one. `wght` is always included. */
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-fraunces",
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
      className={`${plexSans.variable} ${jetbrainsMono.variable} ${cairo.variable} ${amiri.variable} ${fraunces.variable}`}
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
