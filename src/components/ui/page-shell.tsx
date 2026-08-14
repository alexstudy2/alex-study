import React from "react";

export interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "default" | "narrow" | "wide";
}

export function PageShell({
  children,
  size = "default",
  className = "",
  ...props
}: PageShellProps) {
  const sizeClass =
    size === "narrow"
      ? "ui-page-shell-narrow narrow"
      : size === "wide"
      ? "ui-page-shell-wide wide"
      : "";

  return (
    <main
      className={["page-shell ui-page-shell", sizeClass, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </main>
  );
}
