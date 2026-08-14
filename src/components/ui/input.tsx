import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, id, className = "", ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="ui-form-group">
        {label && (
          <label htmlFor={inputId} className="ui-label">
            {label}
          </label>
        )}
        <div className="ui-input-wrapper">
          {leftIcon && <span className="ui-input-icon-left">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={["ui-input", className].filter(Boolean).join(" ")}
            aria-invalid={Boolean(error)}
            {...props}
          />
          {rightIcon && <span className="ui-input-icon-right">{rightIcon}</span>}
        </div>
        {error && <p className="ui-form-error">{error}</p>}
        {!error && hint && <p className="ui-form-hint">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="ui-form-group">
        {label && (
          <label htmlFor={textareaId} className="ui-label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={["ui-textarea", className].filter(Boolean).join(" ")}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {error && <p className="ui-form-error">{error}</p>}
        {!error && hint && <p className="ui-form-hint">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
