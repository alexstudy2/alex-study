import React from "react";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
}

export function Badge({
  children,
  className = "",
  variant = "default",
  size = "md",
  icon,
  ...props
}: BadgeProps) {
  const variantClass = `ui-badge-${variant}`;
  const sizeClass = `ui-badge-${size}`;

  return (
    <span
      className={["ui-badge", variantClass, sizeClass, className].filter(Boolean).join(" ")}
      {...props}
    >
      {icon && <span className="ui-badge-icon" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
