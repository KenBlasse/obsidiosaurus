import obsidianmd from "eslint-plugin-obsidianmd";
import tsparser from "@typescript-eslint/parser";

export default [
	{ ignores: ["node_modules/**", "main.js"] },
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: "./tsconfig.json" },
		},
		rules: {
			"obsidianmd/ui/sentence-case": [
				"error",
				{
					brands: ["Docusaurus", "Obsidiosaurus", "Obsidian", "WebP"],
				},
			],
		},
	},
];
