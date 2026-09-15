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
  },
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
});
