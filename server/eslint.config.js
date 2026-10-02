import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Bug-catching rules are errors; style/legacy noise is a warning or off so the
// signal stays readable. One-off maintenance scripts are not linted.
export default tseslint.config(
  { ignores: ["dist", "node_modules", "scripts", "src/scripts", "*.cjs", "*.mjs", "*.js", "*.ts", "src/test_*.ts", "src/clear_users*.ts", "src/delete_duplicates.ts"] },
  { linterOptions: { reportUnusedDisableDirectives: "off" } },
  {
    files: ["src/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": "warn",
      "no-useless-escape": "off",
      "prefer-const": "off"
    }
  }
);
