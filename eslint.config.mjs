import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    /*
     * The codebase already marks a deliberately unused parameter with a
     * leading underscore -- every server action takes `_previousState`,
     * because React decides that signature, not us. The default rule does not
     * honour that convention: it stays quiet only while a later parameter
     * happens to be used, so an action that needs neither gets flagged for
     * following the same naming as the ones that do not. This makes the
     * convention mean what it already looks like it means.
     */
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
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
