<script setup lang="ts">
import { IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/vue';

import BaseButton from '@/components/base/BaseButton.vue';

const props = withDefaults(
    defineProps<{
        isOpen: boolean;
        title: string;
        dismissLabel?: string;
        testId?: string;
    }>(),
    {
        dismissLabel: 'Close',
    },
);

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const labelId = `base-modal-title-${Math.random().toString(36).slice(2, 10)}`;

const dismiss = async (ev: MouseEvent) => {
    const modal = (ev.currentTarget as HTMLElement | null)?.closest<HTMLIonModalElement>('ion-modal');
    await modal?.dismiss();
};
</script>

<template>
    <ion-modal :is-open="props.isOpen" :aria-labelledby="labelId" @didDismiss="emit('close')">
        <div class="modal-shell" :data-testid="props.testId">
            <ion-header class="modal-header">
                <ion-toolbar>
                    <ion-title :id="labelId">{{ props.title }}</ion-title>
                </ion-toolbar>
            </ion-header>

            <div class="modal-body">
                <slot />
            </div>

            <div class="modal-actions">
                <BaseButton :test-id="props.testId ? `${props.testId}-dismiss` : undefined" @click="dismiss">
                    {{ props.dismissLabel }}
                </BaseButton>
            </div>
        </div>
    </ion-modal>
</template>

<style lang="scss" scoped>
.modal-shell {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: var(--ion-background-color);
}

.modal-header {
    box-shadow: none;
}

.modal-body {
    flex: 1;
    padding: 1rem;
}

.modal-actions {
    padding: 0 1rem 1rem;
}
</style>
