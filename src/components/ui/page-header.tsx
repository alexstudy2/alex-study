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
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted font-bold mb-1.5 hover:text-foreground transition-colors"
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
