<script setup lang="ts">
import BaseButton from '@/components/base/BaseButton.vue';

import type { ClientCounter } from '@packages/core';

const props = defineProps<{
    counter: ClientCounter;
}>();

const emit = defineEmits<{
    (e: 'delete', counter: ClientCounter): void;
    (e: 'increment', counterId: string, amount: number): void;
    (e: 'showUpdateForm', counter: ClientCounter): void;
}>();

const copyShareLink = async (inviteCode: string) => {
    const url = `${window.location.origin}/join?code=${inviteCode}`;
    // const url = `tally://join?code=${inviteCode}`; // For Dev/Simulator testing

    await navigator.clipboard.writeText(url);
    alert('Share Link copied to clipboard!');
};
</script>

<template>
    <div class="counter-wrapper" :style="{ borderLeft: `solid 2px ${counter.color}` }">
        <h3>{{ counter.title }}</h3>
        <BaseButton @click="emit('increment', counter.id, -1)">-1</BaseButton>
        <h3>{{ counter.count }}</h3>
        <BaseButton @click="emit('increment', counter.id, 1)">+1</BaseButton>
        <BaseButton @click="emit('delete', counter)">delete</BaseButton>
        <BaseButton @click="emit('showUpdateForm', counter)">edit</BaseButton>
        <BaseButton v-if="counter.type === 'SHARED'" @click="copyShareLink(counter.inviteCode as string)"
            >Share</BaseButton
        >
    </div>
</template>

<style lang="scss" scoped>
.counter-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0 2em;
}
</style>
