import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans, Amiri, Cairo, Fraunces } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";
import { AppShell } from "@/components/navigation/app-shell";
import { StudyBackground } from "@/components/ui/study-background";
import { moodFromEnum } from "@/lib/settings/study-mood";
import { skinFromEnum } from "@/lib/settings/study-skin";
import { Providers } from "@/components/providers";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import "./globals.css";

/* Five families, all self-hosted: next.config.ts sets CSP `font-src 'self' data:`, so a Google
   CDN stylesheet would be blocked outright. Which token each one fills, and why these five,
   is documented in the Fonts block of src/styles/tokens.css. */

/* Body, labels, controls. No `weight` on purpose -- that pulls the variable font, so the app's
   400/700/800 declarations interpolate off one file instead of downloading three.

   This replaced IBM Plex Sans, whose variable wght axis stops at 700. A variable font clamps to
   its axis range rather than synthesising a heavier face, so the 156 `font-weight: 800` and 34
   `font-weight: 900` rules in the stylesheets were all rendering at 700 -- which is why the body
   text read as under-weight and generic next to Fraunces headings that do reach 900. Jakarta's
   axis runs 200-800, so every 800 is now real and only the 34 900s clamp, to 800. */
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

/* Timers, scoreboards and counters. The variable is `--font-jetbrains`, not `--font-mono`: this
   class lands on the same <html> element that tokens.css styles as `:root`, so naming it
   `--font-mono` put two same-specificity declarations of that property on one element, and the
   tokens.css one (`--font-mono: var(--font-mono), …`) then referenced itself. A self-referential
   custom property is a dependency cycle, which computes to the guaranteed-invalid value -- so
   whenever that declaration won the cascade, every `font-family: var(--font-mono)` in the app
   silently inherited the body sans instead. Every other face here already uses a distinct raw
   name (--font-jakarta, --font-fraunces, --font-arabic) and is spliced into its semantic token in
   tokens.css; mono is now the same shape. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

/* Arabic body, labels and controls -- the RTL counterpart to Plus Jakarta Sans. Cairo is a variable
   humanist Arabic (wght 200-1000), so like Jakarta it interpolates every weight the UI asks for off a
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
          preference: { select: { locale: true, studyMood: true, skin: true } },
          _count: { select: { notifications: { where: { readAt: null } } } },
        },
      })
    : null;
  const locale = profile?.preference?.locale.toLowerCase() ?? (await getLocale());
  const messages = await getMessages({ locale });
  /* Rendered onto <html> so the correct palette is in the very first paint. Reading it
     from localStorage after hydration is what caused the flash of the wrong theme. */
  const mood = moodFromEnum(profile?.preference?.studyMood);
  /* Same reasoning, second axis: the skin decides every radius, border and shadow in the
     app, so resolving it client-side would repaint every surface one frame after hydration
     -- a far louder flash than the palette one, because it changes geometry and not just
     colour. Mood picks the colours, skin picks the materials. */
  const skin = skinFromEnum(profile?.preference?.skin);
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${jakartaSans.variable} ${jetbrainsMono.variable} ${cairo.variable} ${amiri.variable} ${fraunces.variable}`}
      data-mood={mood}
      data-skin={skin}
      suppressHydrationWarning
    >
      {/* Performance tier before first paint. Atlas composites dozens of backdrop-filter
          sheets over a moving background; on hardware that cannot hold that at frame rate,
          the very first frame should already be the cheap one instead of restyling the whole
          page moments after painting. This mirrors forcedPerfMode()/detectWeakDevice() in
          src/lib/settings/perf-mode.ts (which cannot be imported here: bundled code has not
          run yet) -- keep the two behaviourally identical. It can only ever ADD "lite";
          absence of the attribute means full. study-background.tsx re-resolves after
          hydration and additionally demotes devices whose measured frame rate says the
          static signals lied. The CSP already allows 'unsafe-inline'. */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var f=localStorage.getItem("alex-study-perf");if(f==="lite"){document.documentElement.setAttribute("data-perf","lite");return}if(f==="full")return;var n=navigator,d=n.deviceMemory;if(typeof d==="number"&&d>0&&d<=4){document.documentElement.setAttribute("data-perf","lite");return}if(n.connection&&n.connection.saveData){document.documentElement.setAttribute("data-perf","lite");return}var c=n.hardwareConcurrency||0;if(c>0&&c<=6&&matchMedia("(pointer: coarse)").matches)document.documentElement.setAttribute("data-perf","lite")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col relative">
        <StudyBackground initialMood={mood} initialSkin={skin} />
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
