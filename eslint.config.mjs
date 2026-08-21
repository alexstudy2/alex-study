import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // `.claude/**` joins `.agents/**` for the same reason: both hold vendored agent tooling
  // (skill scripts, settings) rather than app source. The skill scripts are CommonJS `.cjs`
  // by design, so linting them only ever produces `no-require-imports` noise on files this
  // project does not own and cannot fix upstream.
  globalIgnores([".next/**", "out/**", "build/**", ".agents/**", ".claude/**", "next-env.d.ts"]),
]);