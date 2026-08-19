"use client";

import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff, Minus, Plus } from "lucide-react";

/**
 * Field primitives for the auth pages.
 *
 * Labels are explicit (`htmlFor`) rather than wrapping, because PasswordField puts a button
 * beside the input: inside a <label>, a click on that button also triggers the label's
 * activation behaviour and re-focuses the input, so the reveal toggle fights itself.
 */

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="auth-field-hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Field({
  name,
  label,
  type = "text",
  autoComplete,
  required = true,
  hint,
  error,
  value,
  onChange,
  placeholder,
  inputMode,
  maxLength,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  inputMode?: "text" | "email" | "numeric";
  maxLength?: number;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        {...(onChange ? { value: value ?? "", onChange: (e) => onChange(e.target.value) } : {})}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  value,
  onChange,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        name={name}
        {...(onChange
          ? { value: value ?? "", onChange: (e) => onChange(e.target.value) }
          : { defaultValue: value })}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function PasswordField({
  name,
  label,
  autoComplete = "current-password",
  hint,
  error,
  value,
  onChange,
  minLength,
  revealLabel,
  hideLabel,
}: {
  name: string;
  label: string;
  autoComplete?: string;
  hint?: string;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
  minLength?: number;
  revealLabel: string;
  hideLabel: string;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="auth-field-control">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          aria-invalid={error ? true : undefined}
          {...(onChange ? { value: value ?? "", onChange: (e) => onChange(e.target.value) } : {})}
        />
        <button
          type="button"
          className="auth-reveal-btn"
          onClick={() => setShown((current) => !current)}
          aria-label={shown ? hideLabel : revealLabel}
          aria-pressed={shown}
        >
          {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </FieldShell>
  );
}

/** 0-4. Length carries most of the weight because it is the only rule the server enforces. */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function PasswordStrength({ password, labels }: { password: string; labels: string[] }) {
  const score = passwordStrength(password);
  return (
    <div className="auth-strength">
      <span className="auth-strength-track" aria-hidden="true">
        {[0, 1, 2, 3].map((tick) => (
          <span
            key={tick}
            className={`auth-strength-tick ${tick < score ? "on" : ""} ${
              score === 4 && tick < score ? "strong" : ""
            }`}
          />
        ))}
      </span>
      <span className="auth-strength-label" aria-live="polite">
        {labels[score]}
      </span>
    </div>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  step = 5,
  unit,
  decreaseLabel,
  increaseLabel,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className="auth-stepper">
      <span className="auth-stepper-label" id={id}>
        {label}
      </span>
      {/* A spinbutton rather than a number input: the -/+ pair is the whole control, and a
          native input would add a second set of OS spinners next to the drawn ones. */}
      <div
        className="auth-stepper-row"
        role="spinbutton"
        aria-labelledby={id}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${value} ${unit}`}
      >
        <button
          type="button"
          className="auth-stepper-btn"
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          aria-label={`${decreaseLabel} — ${label}`}
        >
          <Minus aria-hidden="true" />
        </button>
        <span className="auth-stepper-value">
          {value}
          <span className="auth-stepper-unit"> {unit}</span>
        </span>
        <button
          type="button"
          className="auth-stepper-btn"
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          aria-label={`${increaseLabel} — ${label}`}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function ToggleRow({
  checked,
  onChange,
  title,
  note,
  icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  note?: string;
  icon?: ReactNode;
}) {
  return (
    <label className="auth-toggle-row">
      {icon && (
        <span className="auth-toggle-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="auth-toggle-text">
        <span className="auth-toggle-title">{title}</span>
        {note && <span className="auth-toggle-note">{note}</span>}
      </span>
      {/* A real toggle switch, not a boxed checkbox. The native input stays in the label -- it
          is the accessible control the row toggles, the keyboard reaches and a screen reader
          announces -- but is pulled out of the visual flow (.auth-switch-input). The drawn
          track + knob beside it is what shows, driven off the input's :checked state. */}
      <input
        type="checkbox"
        className="auth-switch-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="auth-switch" aria-hidden="true">
        <span className="auth-switch-knob" />
      </span>
    </label>
  );
}
