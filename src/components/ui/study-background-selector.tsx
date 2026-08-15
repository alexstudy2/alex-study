"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, BookOpen, Moon, Compass, Coffee, Check, ChevronDown } from "lucide-react";
import type { StudyMood } from "./study-background";

export const MOOD_STORAGE_KEY = "alex-study-bg-mood";

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
    colorToken: "#49B6E5",
  },
  {
    id: "cosmic",
    labelEn: "Cosmic Starfield",
    labelAr: "سماء التركيز",
    descEn: "Deep midnight nebula with twinkling stars",
    descAr: "سماء ليلية عميقة مع نجوم متلألئة",
    icon: Moon,
    colorToken: "#8B5CF6",
  },
  {
    id: "aurora",
    labelEn: "Zen Aurora",
    labelAr: "أورورا هادئة",
    descEn: "Calming breathing mint and cyan mesh",
    descAr: "تدرجات أورورا خضراء وسماوية هادئة",
    icon: Compass,
    colorToken: "#10B981",
  },
  {
    id: "sunset",
    labelEn: "Sunset Cafe",
    labelAr: "كافيه الغروب",
    descEn: "Warm amber dusk for focused inspiration",
    descAr: "أجواء غروب ذهبية محفزة للإلهام",
    icon: Coffee,
    colorToken: "#F59E0B",
  },
];

export function StudyBackgroundSelector({
  locale = "en",
  variant = "sidebar",
}: {
  locale?: "en" | "ar";
  variant?: "sidebar" | "compact" | "cards";
}) {
  const [currentMood, setCurrentMood] = useState<StudyMood>("notebook");
  const [isOpen, setIsOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MOOD_STORAGE_KEY) as StudyMood | null;
      if (saved && STUDY_MOODS.some((m) => m.id === saved)) {
        setCurrentMood(saved);
      }
    } catch {
      // Ignore
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === MOOD_STORAGE_KEY && e.newValue) {
        startTransition(() => setCurrentMood(e.newValue as StudyMood));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const selectMood = (mood: StudyMood) => {
    startTransition(() => {
      setCurrentMood(mood);
      try {
        localStorage.setItem(MOOD_STORAGE_KEY, mood);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: MOOD_STORAGE_KEY,
            newValue: mood,
          })
        );
      } catch {
        // Ignore
      }
      setIsOpen(false);
    });
  };

  const isAr = locale === "ar";
  const title = isAr ? "أجواء وخلفية المذاكرة" : "Study Background Mood";
  const activeMoodObj = STUDY_MOODS.find((m) => m.id === currentMood) ?? STUDY_MOODS[0];
  const ActiveIcon = activeMoodObj.icon;

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
