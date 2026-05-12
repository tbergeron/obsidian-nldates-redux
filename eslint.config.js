import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidian from "eslint-plugin-obsidianmd";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    plugins: {
      obsidianmd: obsidian,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        window: "readonly",
      },
    },
    rules: {
      ...Object.fromEntries(
        Object.keys(obsidian.rules).map((rule) => [
          `obsidianmd/${rule}`,
          "error",
        ])
      ),
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "all", argsIgnorePattern: "^_" },
      ],
      "obsidianmd/ui/sentence-case": "off",
      "no-control-regex": "off",
    },
  },
  {
    ignores: [".pnpm-store/**", "node_modules/**", "main.js"],
  }
);
