"use client";

import React, { forwardRef } from "react";
import Link from "next/link";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "danger"
  | "outline"
  | "ghost"
  | "subtle";

export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  href?: string;
  target?: string;
  rel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      href,
      target,
      rel,
      ...props
    },
    ref
  ) => {
    const variantClass = `btn-${variant}`;
    const sizeClass = size === "icon-sm" ? "btn-icon-sm" : size === "icon" ? "btn-icon" : `btn-${size}`;
    const combinedClassName = ["btn", variantClass, sizeClass, className].filter(Boolean).join(" ");

    if (href) {
      return (
        <Link
          href={href}
          className={combinedClassName}
          target={target}
          rel={rel}
          aria-disabled={disabled || isLoading}
          aria-busy={isLoading ? "true" : undefined}
          tabIndex={disabled || isLoading ? -1 : undefined}
        >
          {isLoading ? (
            <span className="btn-spinner" aria-hidden="true" />
          ) : (
            leftIcon && <span className="btn-icon-left" aria-hidden="true">{leftIcon}</span>
          )}
          {children}
          {!isLoading && rightIcon && (
            <span className="btn-icon-right" aria-hidden="true">{rightIcon}</span>
          )}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={props.type || "button"}
        className={combinedClassName}
        disabled={disabled || isLoading}
        aria-busy={isLoading ? "true" : undefined}
        {...props}
      >
        {isLoading ? (
          <span className="btn-spinner" aria-hidden="true" />
        ) : (
          leftIcon && <span className="btn-icon-left" aria-hidden="true">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className="btn-icon-right" aria-hidden="true">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
