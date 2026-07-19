import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Canvas game loops are intentionally imperative (rAF + mutable refs +
 * Math.random). React Compiler eslint rules that assume pure functional
 * components produce hundreds of false positives on that pattern. Keep
 * strict rules for the platform shell; relax only under app/games/.
 */
const gameOverrides = {
  files: ["app/games/**/*.{ts,tsx}"],
  rules: {
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/immutability": "off",
    "react-hooks/refs": "off",
    "react-hooks/purity": "off",
    "react-hooks/static-components": "off",
    // Canvas games often declare die/checkEnd after the loop; still flag
    // genuine rules-of-hooks mistakes.
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
  },
};

const platformOverrides = {
  files: ["lib/platform/**/*.{ts,tsx}", "app/components/**/*.{ts,tsx}", "app/play/**/*.{ts,tsx}"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
  gameOverrides,
  platformOverrides,
]);

export default eslintConfig;
