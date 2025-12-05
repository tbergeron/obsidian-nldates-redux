import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidian from "eslint-plugin-obsidianmd";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      obsidianmd: obsidian,
    },
    rules: {
      // Obsidian plugin rules
      "obsidianmd/commands/no-command-in-command-id": "error",
      "obsidianmd/commands/no-command-in-command-name": "error",
      "obsidianmd/commands/no-default-hotkeys": "error",
      "obsidianmd/commands/no-plugin-id-in-command-id": "error",
      "obsidianmd/commands/no-plugin-name-in-command-name": "error",
      "obsidianmd/settings-tab/no-manual-html-headings": "error",
      "obsidianmd/settings-tab/no-problematic-settings-headings": "error",
      "obsidianmd/vault/iterate": "error",
      "obsidianmd/detach-leaves": "error",
      "obsidianmd/hardcoded-config-path": "error",
      "obsidianmd/no-forbidden-elements": "error",
      "obsidianmd/no-plugin-as-component": "error",
      "obsidianmd/no-sample-code": "error",
      "obsidianmd/no-tfile-tfolder-cast": "error",
      "obsidianmd/no-view-references-in-plugin": "error",
      "obsidianmd/no-static-styles-assignment": "error",
      "obsidianmd/object-assign": "error",
      "obsidianmd/platform": "error",
      "obsidianmd/prefer-file-manager-trash-file": "warn",
      "obsidianmd/prefer-abstract-input-suggest": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/sample-names": "error",
      "obsidianmd/validate-manifest": "error",
      "obsidianmd/validate-license": "error",
      "obsidianmd/ui/sentence-case": ["error", { enforceCamelCaseLower: true }],

      // General rules from Obsidian's recommended config
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "moment",
              importNames: ["default"],
              message:
                "The 'moment' package is bundled with Obsidian. Please use window.moment instead.",
            },
          ],
        },
      ],
      "no-console": ["error", { allow: ["warn", "error", "debug"] }],
      "no-alert": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/restrict-template-expressions": "error",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { args: "all", argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-explicit-any": ["error", { fixToUnknown: true }],

      // Project-specific overrides
      "no-control-regex": "off",
    },
  },
  {
    ignores: [
      ".pnpm-store/**",
      "node_modules/**",
      "main.js",
      "*.config.js",
      "*.config.mjs",
    ],
  }
);
