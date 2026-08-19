/**
 * The locale cookie next-intl reads on the server (src/i18n/request.ts) to choose the request
 * locale. It is written from the client at the two points a user picks a language outside the
 * server round-trip -- the settings account form and the sign-up wizard -- so the very next
 * navigation already renders in the language they just chose.
 *
 * A module-level function on purpose. Writing `document.cookie` straight inside a component body
 * trips react-hooks/immutability (the React Compiler reads it as mutating a value owned outside
 * the component); the same statement behind a plain function call does not, because the callee is
 * neither a component nor a hook. Keeping the cookie's name and one-year max-age in one place is
 * the bonus -- the string used to be copied verbatim in both call sites.
 */
export const LOCALE_COOKIE = "alex-study-locale";

export function writeLocaleCookie(locale: string): void {
  document.cookie = `${LOCALE_COOKIE}=${locale.toLowerCase()}; path=/; max-age=31536000; samesite=lax`;
}
