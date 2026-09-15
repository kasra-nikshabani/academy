import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Architecture boundaries (CLAUDE.md §2, §4):
 *   Presentation → API → Service → Repository → Prisma
 * Imports that would let a layer reach past its neighbour are blocked here so
 * the rule is enforced by tooling, not by review discipline alone.
 */
const dataAccessRestrictions = {
  paths: [
    {
      name: "@prisma/client",
      message:
        "UI و Route Handler نباید مستقیم به Prisma دسترسی داشته باشند. از Service استفاده کنید (CLAUDE.md §4). برای Type از `import type` استفاده کنید.",
      allowTypeImports: true,
    },
  ],
  patterns: [
    {
      group: ["@/lib/repositories", "@/lib/repositories/*", "@/lib/db"],
      message:
        "Repository فقط از داخل Service صدا زده می‌شود، نه از UI یا Route Handler (CLAUDE.md §4).",
      allowTypeImports: true,
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    name: "academy/rules",
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // Logging goes through lib/logger so OTP/token/PII redaction always applies
      // (CLAUDE.md §27).
      "no-console": "error",
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  {
    name: "academy/layer-boundaries",
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        dataAccessRestrictions,
      ],
    },
  },

  {
    name: "academy/repository-layer",
    files: ["lib/repositories/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/services", "@/lib/services/*"],
              message:
                "Repository نباید به Service وابسته باشد؛ جهت وابستگی یک‌طرفه است (CLAUDE.md §4).",
            },
          ],
        },
      ],
    },
  },

  {
    name: "academy/tooling",
    files: [
      "*.config.{ts,mts,mjs,js}",
      "prisma/**/*.ts",
      "scripts/**/*.ts",
      "tests/**/*.ts",
      "e2e/**/*.ts",
      "**/*.test.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "node_modules/**",
    "lib/generated/**",
  ]),
]);

export default eslintConfig;
