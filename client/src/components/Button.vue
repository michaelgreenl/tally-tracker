<script setup lang="ts">
import { IonButton } from '@ionic/vue';

interface Props {
    text?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: 'click', event: MouseEvent): void;
}>();
</script>

<template>
    <ion-button @click="$emit('click', $event)">{{ text }}</ion-button>
</template>

<style lang="scss" scoped>
button {
    padding: 8px 16px;
    cursor: pointer;
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 4px;
    border-radius: $border-radius-xs;
}
</style>
