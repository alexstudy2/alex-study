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
            className="inline-flex items-center gap-1.5 text-xs text-muted font-medium mb-1.5 hover:text-foreground transition-colors"
          >
            <BackIcon className="w-3.5 h-3.5" />
            <span>{backLabel || (isRtl ? "رجوع" : "Back")}</span>
          </Link>
        )}
        {eyebrow && <span className="eyebrow block text-xs font-semibold text-accent uppercase tracking-wider mb-1">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
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
