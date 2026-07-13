module.exports = {
    extends: [
        'stylelint-config-standard-scss',
        'stylelint-config-standard-vue/scss',
        'stylelint-config-prettier-scss',
        'stylelint-config-recess-order',
    ],
    rules: {
        // Disable overly strict rules
        'selector-max-type': null,
        'no-empty-source': null,
        'scss/at-rule-no-unknown': null,

        // Enforce consistent naming
        'selector-class-pattern': null, // Allow any class naming convention
        'custom-property-pattern': null, // Allow any CSS variable naming

        // SCSS-specific rules
        'scss/dollar-variable-pattern': null,
        'scss/percent-placeholder-pattern': null,
        'scss/at-mixin-pattern': null,

        // Color rules
        'color-function-notation': 'modern',
        'alpha-value-notation': 'number',

        // Disable some overly strict rules for Vue
        'selector-pseudo-class-no-unknown': [
            true,
            {
                ignorePseudoClasses: ['deep', 'global', 'slotted'],
            },
        ],
        'selector-pseudo-element-no-unknown': [
            true,
            {
                ignorePseudoElements: ['v-deep', 'v-global', 'v-slotted'],
            },
        ],
    },
};
