import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      /* Server modules carry `import "server-only"` as a bundler-level guarantee. Next
         aliases it at build time, but vitest would otherwise either fail resolution or
         trip the package's client-side throw -- so point it at a no-op stub and let the
         suites import server modules freely (they run in Node here anyway). */
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
