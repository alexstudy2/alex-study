import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ children, className = "", hover = false, ...props }: CardProps) {
  return (
    <div
      className={["ui-card", hover ? "ui-card-hover" : "", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  withBorder?: boolean;
}

export function CardHeader({ children, className = "", withBorder = false, ...props }: CardHeaderProps) {
  return (
    <div
      className={["ui-card-header", withBorder ? "with-border" : "", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "", ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={["ui-card-title", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={["ui-card-description", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["ui-card-content", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["ui-card-footer", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}
