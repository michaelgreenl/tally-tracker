<script setup lang="ts">
interface Props {
    id: string;
    modelValue: string;
    required?: boolean;
    disabled?: boolean;
    showPassword?: boolean;
    passwordHideButton?: boolean;
}

withDefaults(defineProps<Props>(), {
    required: false,
    disabled: false,
    showPassword: true,
    passwordHideButton: false,
});

const emit = defineEmits<{
    (e: 'toggleHideButton'): void;
    (e: 'update:modelValue', value: string): void;
    (e: 'focus', event: FocusEvent): void;
    (e: 'blur', event: FocusEvent): void;
}>();

const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    emit('update:modelValue', target.value);
};
</script>

<template>
    <div class="input-wrapper">
        <input
            :id="id"
            :value="modelValue"
            :type="showPassword ? 'text' : 'password'"
            :required="required"
            :disabled="disabled"
            @focus="$emit('focus', $event)"
            @blur="$emit('blur', $event)"
            @input="handleInput"
        />
        <button
            v-if="passwordHideButton"
            type="button"
            class="toggle-password"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="$emit('toggleHideButton')"
            @mousedown.prevent
        >
            {{ showPassword ? 'Hide' : 'Show' }}
        </button>
    </div>
</template>

<style lang="scss" scoped>
.input-wrapper {
    position: relative;
    width: 100%;
}

input[type='text'],
input[type='password'] {
    width: 100%;
    padding: $size-2;
    color: $color-text-secondary-dark;
    background-color: $color-bg-secondary;
    border: 2px solid $color-primary-light;
    border-radius: $border-radius-sm;
    outline: 0;

    &:focus {
        border-color: $color-accent;
    }
}

.toggle-password {
    position: absolute;
    top: 50%;
    right: 8px;
    font-size: 0.8em;
    color: $color-accent-light;
    background: none;
    border: none;
    transform: translateY(-50%);

    &:hover {
        color: $color-accent;
    }
}
</style>
