import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  isRtl?: boolean;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  backHref,
  backLabel,
  actions,
  children,
  className = "",
  isRtl = false,
}: PageHeaderProps) {
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  return (
    <header className={["page-header-container", className].filter(Boolean).join(" ")}>
      <div className="page-header-main">
        {backHref && (
          // min-h-6 is the WCAG 2.5.8 24px floor: the 12px label and 16px icon left this
          // standalone breadcrumb control only 19px tall.
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 min-h-6 text-xs text-muted font-bold mb-1.5 hover:text-foreground transition-colors"
          >
            <BackIcon className="w-4 h-4" />
            <span>{backLabel || (isRtl ? "رجوع" : "Back")}</span>
          </Link>
        )}
        {eyebrow && <span className="eyebrow block text-xs font-bold uppercase tracking-wider mb-1">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p className="mt-1">{description}</p>}
      </div>

      {(actions || children) && (
        <div className="page-header-actions">
          {actions}
          {children}
        </div>
      )}
    </header>
  );
}
