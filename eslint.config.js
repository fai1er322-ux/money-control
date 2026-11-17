import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "dist/",
      "coverage/",
      "playwright-report/",
      "test-results/",
      ".specify/",
      ".claude/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // `const { removed: _removed, ...rest } = obj` is the idiom for dropping a field.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    // Constitution II: user amounts and profile data must never reach logs.
    files: ["src/domain/**", "src/storage/**"],
    rules: { "no-console": "error" },
  },
  {
    files: ["*.config.{js,ts}", "tests/**"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Tests index into fixtures they just built; `!` there is clearer than guards.
    files: ["tests/**"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
);
