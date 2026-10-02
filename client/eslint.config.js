import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Bug-catching rules are errors; style/legacy noise is a warning or off so the
// signal stays readable. Tighten gradually as the codebase is cleaned up.
export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  { linterOptions: { reportUnusedDisableDirectives: "off" } },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": "warn",
      "no-useless-escape": "off",
      "prefer-const": "off"
    }
  }
);
