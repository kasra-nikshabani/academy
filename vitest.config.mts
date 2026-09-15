import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
    // Loads .env so integration tests can reach the database.
    setupFiles: ["dotenv/config"],

    /**
     * Test files run one at a time.
     *
     * The integration suites share one database and deliberately mutate seeded
     * state — one ends a coach's team assignment and restores it, another
     * resolves that same coach's scope. Run in parallel they interleave, and
     * the result is a suite that fails perhaps one run in three with an error
     * that points at the wrong place. The whole suite takes about two seconds,
     * so serialising costs nothing worth having.
     */
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
});
