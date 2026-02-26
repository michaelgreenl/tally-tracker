import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import pluginVue from "eslint-plugin-vue";
import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
    {
        name: "app/files-to-lint",
        files: ["**/*.{vue,ts,mts,tsx}"],
    },

    {
        name: "app/files-to-ignore",
        ignores: ["**/dist/**", "**/dist-ssr/**", "**/coverage/**", "**/node_modules/**"],
    },

    ...pluginVue.configs["flat/essential"],
    vueTsConfigs.recommended,

    {
        name: "app/custom-rules",

        languageOptions: {
            parserOptions: {
                ecmaVersion: 2020,
            },
        },

        rules: {
            // Vue-specific rules
            "vue/multi-word-component-names": "warn",
            "vue/no-unused-vars": "error",
            "vue/no-v-html": "warn",
            "vue/require-default-prop": "off",
            "vue/require-explicit-emits": "error",
            "vue/component-name-in-template-casing": ["error", "PascalCase"],
            "vue/custom-event-name-casing": ["error", "camelCase"],
            "vue/no-deprecated-slot-attribute": "off",

            // TypeScript rules
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",

            // General rules
            "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
            "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
        },
    },
    skipFormatting,
);
