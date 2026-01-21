<script setup lang="ts">
import { IonItem, IonInput, IonLabel, IonIcon, IonNote } from '@ionic/vue';
import { eye, eyeOff } from 'ionicons/icons';

const props = defineProps<{
    label: string;
    modelValue: string;
    type?: 'text' | 'password' | 'email';
    error?: string | null;
    placeholder?: string;
    disabled?: boolean;
    showPasswordToggle?: boolean;
    isPasswordVisible?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'toggle-password'): void;
}>();
</script>

<template>
    <div class="input-wrapper">
        <ion-item fill="outline" mode="md" :class="{ 'ion-invalid': !!error }">
            <ion-label position="floating">{{ label }}</ion-label>
            <ion-input
                :value="modelValue"
                :type="isPasswordVisible ? 'text' : type"
                :placeholder="placeholder"
                :disabled="disabled"
                @ionInput="emit('update:modelValue', $event.target.value)"
            ></ion-input>
            <ion-icon
                v-if="showPasswordToggle"
                slot="end"
                :icon="isPasswordVisible ? eyeOff : eye"
                @click="emit('toggle-password')"
                class="password-icon"
            ></ion-icon>
        </ion-item>
        <ion-note slot="error" v-if="error" color="danger">
            {{ error }}
        </ion-note>
    </div>
</template>

<style scoped>
.input-wrapper {
    margin-bottom: 20px;
}
.password-icon {
    cursor: pointer;
    opacity: 0.7;
}
</style>
