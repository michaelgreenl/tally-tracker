<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCounterStore } from '@/stores/counterStore';

const route = useRoute();
const router = useRouter();
const counterStore = useCounterStore();

onMounted(async () => {
    const inviteCode = route.query.code as string;

    if (!inviteCode) {
        alert('Invalid link');
        return router.push('/home');
    }

    const result = await counterStore.joinCounter(inviteCode);

    if (result.success) {
        alert('Counter accepted!');
    } else {
        alert('Failed to join: ' + result.message);
    }

    router.push('/home');
});
</script>

<template>
    <div class="ion-padding">
        <h2>Joining Counter...</h2>
        <ion-spinner></ion-spinner>
    </div>
</template>
