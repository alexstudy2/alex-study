import React, { forwardRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, children, id, className = "", ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="ui-form-group">
        {label && (
          <label htmlFor={selectId} className="ui-label">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={["ui-select", className].filter(Boolean).join(" ")}
          aria-invalid={Boolean(error)}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && <p className="ui-form-error">{error}</p>}
        {!error && hint && <p className="ui-form-hint">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
