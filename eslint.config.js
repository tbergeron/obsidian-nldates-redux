import obsidian from "eslint-plugin-obsidianmd";

export default [
  ...obsidian.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "all", argsIgnorePattern: "^_" },
      ],
      "no-control-regex": "off",
    },
  },
  {
    ignores: [".pnpm-store/**", "node_modules/**", "main.js"],
  },
];

