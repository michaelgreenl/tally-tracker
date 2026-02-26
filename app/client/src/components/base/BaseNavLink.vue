<script setup lang="ts">
import { IonButton } from '@ionic/vue';
import { useRouter } from 'vue-router';

const props = defineProps<{
    to: string;
    direction?: 'forward' | 'back' | 'root';
}>();

const router = useRouter();

const handleNavigation = async (ev: Event) => {
    const target = ev.target as HTMLElement;
    target.blur();

    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }

    router.push(props.to);
};
</script>

<template>
    <ion-button
        fill="clear"
        :router-link="to"
        :router-direction="direction || 'forward'"
        class="base-nav-link"
        @click="handleNavigation"
    >
        <slot />
    </ion-button>
</template>

<style scoped>
.base-nav-link {
    --padding-start: 0;
    --padding-end: 0;
    --ripple-color: transparent;

    font-weight: 600;
    text-transform: none;
    font-size: 0.95rem;
    margin: 0;
    height: auto;
    min-height: 0;
}
</style>
