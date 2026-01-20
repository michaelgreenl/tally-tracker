<script setup lang="ts">
import { IonButton, IonSpinner } from '@ionic/vue';

const props = defineProps<{
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit';
    expand?: 'block' | 'full';
    color?: string;
}>();

const emit = defineEmits<{
    (e: 'click', event: MouseEvent): void;
}>();
</script>

<template>
    <ion-button
        :type="type"
        :disabled="disabled || loading"
        :expand="expand || 'block'"
        :color="color"
        mode="md"
        @click="$emit('click', $event)"
    >
        <ion-spinner v-if="loading" name="crescent"></ion-spinner>
        <slot v-else />
    </ion-button>
</template>
