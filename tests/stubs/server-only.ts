/**
 * Vitest stub for the `server-only` package (see vitest.config.mts).
 *
 * In a Next.js build the real package enforces the server/client boundary through
 * export conditions; under Node-based unit tests that mechanism is meaningless -- the
 * test process IS the server. This stub keeps those imports resolvable and inert.
 */
export {};
