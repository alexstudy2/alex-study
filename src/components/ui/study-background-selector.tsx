"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, BookOpen, Moon, Compass, Coffee, Heart, Check, ChevronDown } from "lucide-react";
import {
  MOOD_STORAGE_KEY,
  MOOD_SWATCH,
  applyMood,
  saveMood,
  type StudyMood,
} from "@/lib/settings/study-mood";

export const STUDY_MOODS: {
  id: StudyMood;
  labelEn: string;
  labelAr: string;
  descEn: string;
  descAr: string;
  icon: typeof BookOpen;
  colorToken: string;
}[] = [
  {
    id: "notebook",
    labelEn: "Lofi Notebook",
    labelAr: "دفتر المذاكرة",
    descEn: "Clean graph paper with warm study glow",
    descAr: "ورق مربعات هادئ مع إضاءة دافئة",
    icon: BookOpen,
    colorToken: MOOD_SWATCH.notebook,
  },
  {
    id: "sakura",
    labelEn: "Sakura Bloom",
    labelAr: "وردي وبنفسجي (Girly)",
    descEn: "Dreamy floral pastel paper with gentle study doodles",
    descAr: "أجواء وردية وبنفسجية حالمة ومبهجة للمذاكرة",
    icon: Heart,
    colorToken: MOOD_SWATCH.sakura,
  },
  {
    id: "cosmic",
    labelEn: "Cosmic Starfield",
    labelAr: "سماء التركيز",
    descEn: "Deep midnight nebula with twinkling stars",
    descAr: "سماء ليلية عميقة مع نجوم متلألئة",
    icon: Moon,
    colorToken: MOOD_SWATCH.cosmic,
  },
  {
    id: "aurora",
    labelEn: "Zen Aurora",
    labelAr: "أورورا هادئة",
    descEn: "Calming breathing mint and cyan mesh",
    descAr: "تدرجات أورورا خضراء وسماوية هادئة",
    icon: Compass,
    colorToken: MOOD_SWATCH.aurora,
  },
  {
    id: "sunset",
    labelEn: "Sunset Cafe",
    labelAr: "كافيه الغروب",
    descEn: "Warm amber dusk for focused inspiration",
    descAr: "أجواء غروب ذهبية محفزة للإلهام",
    icon: Coffee,
    colorToken: MOOD_SWATCH.sunset,
  },
];

export function StudyBackgroundSelector({
  locale = "en",
  variant = "sidebar",
  initialMood = "notebook",
}: {
  locale?: "en" | "ar";
  variant?: "sidebar" | "compact" | "cards";
  initialMood?: StudyMood;
}) {
  const [currentMood, setCurrentMood] = useState<StudyMood>(initialMood);
  const [isOpen, setIsOpen] = useState(false);
  const [, startTransition] = useTransition();

  /* Sync only. The starting mood is server-rendered (both as this prop and as `data-mood`
     on <html>), so there is no localStorage read on mount to flash the palette. */
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === MOOD_STORAGE_KEY && e.newValue) {
        startTransition(() => setCurrentMood(e.newValue as StudyMood));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const selectMood = (mood: StudyMood) => {
    const previous = currentMood;
    startTransition(() => {
      setCurrentMood(mood);
      applyMood(mood);
      setIsOpen(false);
    });
    /* Optimistic: the palette has already switched. Undo the whole thing if the write
       fails, so the UI never shows a preference the server did not accept. */
    void saveMood(mood).catch(() => {
      setCurrentMood(previous);
      applyMood(previous);
    });
  };

  const isAr = locale === "ar";
  const title = isAr ? "أجواء وخلفية المذاكرة" : "Study Background Mood";
  const activeMoodObj = STUDY_MOODS.find((m) => m.id === currentMood) ?? STUDY_MOODS[0];
  const ActiveIcon = activeMoodObj.icon;

  /* Flat grid of tappable cards. Used inside the mobile navigation sheet, where a
     nested dropdown would fight the sheet's focus trap. */
  if (variant === "cards") {
    return (
      <div className="study-mood-card-grid" role="radiogroup" aria-label={title}>
        {STUDY_MOODS.map((m) => {
          const Icon = m.icon;
          const active = currentMood === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => selectMood(m.id)}
              className={`study-mood-card ${active ? "active" : ""}`}
            >
              <span className="study-mood-card-icon" style={{ color: m.colorToken }}>
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="study-mood-card-label">
                {isAr ? m.labelAr : m.labelEn}
              </span>
              {active && <Check className="study-mood-card-check" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className="relative w-full text-start">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="study-mood-sidebar-btn"
          title={title}
          aria-label={title}
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="study-mood-icon-bubble">
              <ActiveIcon className="w-4 h-4 text-primary" aria-hidden="true" />
            </span>
            <div className="flex flex-col min-w-0 text-start">
              <span className="text-xs font-extrabold text-foreground truncate">
                {isAr ? activeMoodObj.labelAr : activeMoodObj.labelEn}
              </span>
              <span className="text-[10px] text-muted font-bold truncate">
                {isAr ? "خلفية متحركة" : "Animated Theme"}
              </span>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div className="study-mood-dropdown-menu sidebar-popover" role="menu">
              <div className="p-2.5 pb-1.5 border-b-2 border-dashed border-line flex items-center justify-between">
                <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  {title}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-1.5">
                {STUDY_MOODS.map((m) => {
                  const Icon = m.icon;
                  const active = currentMood === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="menuitem"
                      onClick={() => selectMood(m.id)}
                      className={`study-mood-menu-item ${active ? "active" : ""}`}
                    >
                      <span
                        className="study-mood-item-icon"
                        style={{ color: m.colorToken }}
                      >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <div className="flex flex-col text-start flex-1 min-w-0">
                        <span className="text-xs font-extrabold text-foreground">
                          {isAr ? m.labelAr : m.labelEn}
                        </span>
                        <span className="text-[10px] text-muted truncate">
                          {isAr ? m.descAr : m.descEn}
                        </span>
                      </div>
                      {active && (
                        <Check className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block text-start">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="study-mood-trigger-btn"
        title={title}
        aria-label={title}
        aria-expanded={isOpen}
      >
        <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
        <span className="font-bold text-xs">
          {isAr ? activeMoodObj.labelAr : activeMoodObj.labelEn}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="study-mood-dropdown-menu" role="menu">
            <div className="p-2 pb-1 border-b border-dashed border-line text-xs font-bold text-muted">
              {title}
            </div>
            <div className="flex flex-col gap-1 p-1">
              {STUDY_MOODS.map((m) => {
                const Icon = m.icon;
                const active = currentMood === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="menuitem"
                    onClick={() => selectMood(m.id)}
                    className={`study-mood-menu-item ${active ? "active" : ""}`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span className="flex-1 text-xs font-bold text-start">
                      {isAr ? m.labelAr : m.labelEn}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 text-primary" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
