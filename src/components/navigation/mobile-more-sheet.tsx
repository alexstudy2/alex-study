"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Bell, LogOut, Palette, Settings, X } from "lucide-react";
import { AlexStudyLogo } from "@/components/ui/logo";
import { StudyBackgroundSelector } from "@/components/ui/study-background-selector";
import type { StudyMood } from "@/lib/settings/study-mood";
import { isActive, navigationGroups } from "./navigation-items";

const noopSubscribe = () => () => {};

/* `createPortal` needs a real `document`, which only exists after hydration.
   useSyncExternalStore is the sanctioned way to read that without a setState-in-effect. */
function useIsHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function MobileMoreSheet({
  open,
  onClose,
  pathname,
  ar,
  userName,
  unreadCount,
  initialMood,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  ar: boolean;
  userName: string;
  unreadCount: number;
  initialMood: StudyMood;
  onSignOut: () => void;
}) {
  const hydrated = useIsHydrated();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  /* Stop the page behind the sheet from scrolling. `.app-content` is the real
     scroller in this shell, so locking <body> alone is not enough. */
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("mobile-sheet-open");
    return () => document.body.classList.remove("mobile-sheet-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    /* Focus after the sheet has begun painting, so the browser doesn't try to
       scroll focus into view while the enter transition is still running. */
    const timer = setTimeout(() => closeButtonRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!hydrated) return null;

  const state = open ? "open" : "closed";

  return createPortal(
    <>
      <div
        className="mobile-more-backdrop"
        data-state={state}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className="mobile-more-sheet"
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-label={ar ? "قائمة التنقل" : "Navigation menu"}
        inert={!open}
        onKeyDown={handleKeyDown}
      >
        <header className="mobile-more-header">
          <span className="mobile-more-brand">
            <AlexStudyLogo size={28} />
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            className="mobile-more-close"
            onClick={onClose}
            aria-label={ar ? "إغلاق القائمة" : "Close menu"}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="mobile-more-body">
          <div className="mobile-more-profile">
            <span aria-hidden="true">{userName.trim().slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{userName}</strong>
              <small>{ar ? "استمر في المذاكرة" : "Keep studying"}</small>
            </div>
          </div>

          {navigationGroups.map((group) => (
            <section key={group.title} className="mobile-more-section">
              <h2 className="sidebar-group-title">{ar ? group.titleAr : group.title}</h2>
              <div className="mobile-more-grid">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="mobile-more-tile"
                      aria-current={isActive(pathname, item.href) ? "page" : undefined}
                      onClick={onClose}
                    >
                      <Icon aria-hidden="true" />
                      <span>{ar ? item.labelAr : item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="mobile-more-section">
            <h2 className="sidebar-group-title">
              <Palette aria-hidden="true" className="mobile-more-section-icon" />
              {ar ? "أجواء المذاكرة" : "Study Mood"}
            </h2>
            <StudyBackgroundSelector
              locale={ar ? "ar" : "en"}
              variant="cards"
              initialMood={initialMood}
            />
          </section>

          <section className="mobile-more-section mobile-more-utility">
            <Link
              href="/notifications"
              className="mobile-more-row"
              aria-current={isActive(pathname, "/notifications") ? "page" : undefined}
              onClick={onClose}
            >
              <Bell aria-hidden="true" />
              <span>{ar ? "الإشعارات" : "Notifications"}</span>
              {unreadCount > 0 && (
                <strong className="notification-badge">{Math.min(unreadCount, 99)}</strong>
              )}
            </Link>
            <Link
              href="/settings"
              className="mobile-more-row"
              aria-current={isActive(pathname, "/settings") ? "page" : undefined}
              onClick={onClose}
            >
              <Settings aria-hidden="true" />
              <span>{ar ? "الإعدادات" : "Settings"}</span>
            </Link>
            <button type="button" className="mobile-more-row danger" onClick={onSignOut}>
              <LogOut aria-hidden="true" />
              <span>{ar ? "تسجيل الخروج" : "Sign out"}</span>
            </button>
          </section>
        </div>
      </div>
    </>,
    document.body
  );
}
