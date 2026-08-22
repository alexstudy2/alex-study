/**
 * The structured logging sink.
 *
 * This codebase deliberately contains zero scattered `console.*` calls -- unstructured
 * prints rot into noise and leak internals. This module is the single sanctioned escape
 * hatch: everything it emits is one JSON line per event on stderr, which Vercel (and any
 * serious log drain) captures and indexes natively.
 *
 * `captureError` is the seam future error-reporting attaches to: wiring Sentry later
 * means registering a sink here, not touching the dozens of call sites.
 *
 * Client-side (global-error boundary), there is no stderr to write to -- captureError
 * degrades to a prefixed console.error so browser devtools and any future client
 * monitoring still see the failure instead of it vanishing (audit M5).
 */

type ErrorSink = (scope: string, error: unknown, meta?: Record<string, unknown>) => void;

let externalSink: ErrorSink | null = null;

/** Register an external error reporter (e.g. Sentry) without touching call sites. */
export function setErrorSink(sink: ErrorSink) {
  externalSink = sink;
}

function describe(error: unknown): Record<string, unknown> {
  if (error instanceof Error)
    return { name: error.name, message: error.message, stack: error.stack };
  return { value: String(error) };
}

function emit(
  level: "error" | "warn",
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
  error?: unknown,
) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(meta ? { meta } : {}),
    ...(error !== undefined ? { error: describe(error) } : {}),
  });
  /* Intentional console use -- see module comment. stderr for errors/warnings. */
  if (level === "error") console.error(line);
  else console.warn(line);
}

/** Structured warning line. Used for boot-time degradation notices and similar. */
export function logWarn(scope: string, message: string, meta?: Record<string, unknown>) {
  emit("warn", scope, message, meta);
}

/**
 * Report an error through every configured channel: structured stderr always, plus the
 * external sink when one is registered. Safe on the client too, where it falls back to a
 * plain prefixed console.error.
 */
export function captureError(scope: string, error: unknown, meta?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    console.error(`[${scope}]`, error);
    return;
  }
  emit("error", scope, error instanceof Error ? error.message : "non-error thrown", meta, error);
  try {
    externalSink?.(scope, error, meta);
  } catch {
    /* A failing reporter must never take the caller down with it. */
  }
}
