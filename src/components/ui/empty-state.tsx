import React from "react";
import { Button } from "./button";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = "",
  children,
}: EmptyStateProps) {
  return (
    <div className={["ui-empty-state", className].filter(Boolean).join(" ")}>
      {icon && <div className="ui-empty-icon">{icon}</div>}
      <h3 className="ui-empty-title">{title}</h3>
      {description && <p className="ui-empty-description">{description}</p>}
      {actionLabel && (actionHref || onAction) && (
        <Button
          variant="primary"
          size="sm"
          href={actionHref}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
