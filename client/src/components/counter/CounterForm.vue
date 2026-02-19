<script setup lang="ts">
import { ref } from 'vue';
import { useCounterStore } from '@/stores/counterStore';
import { useAuthStore } from '@/stores/authStore';
import BaseButton from '@/components/base/BaseButton.vue';
import TextInput from '@/components/inputs/TextInput.vue';
import { IonItem, IonLabel, IonToggle, IonNote, IonIcon } from '@ionic/vue';
import { diamond } from 'ionicons/icons';

import type { UpdateCounterRequest } from '@/types/shared/requests';
import type { ClientCounter } from '@/types/shared/models';
import type { CounterTypeType as CounterType } from '@/types/shared/generated/index';
import type { HexColor } from '@/types/shared';

const props = defineProps<{
    counter?: ClientCounter;
}>();

const emit = defineEmits<{
    (e: 'done'): void;
}>();

const counterStore = useCounterStore();
const authStore = useAuthStore();

const localCounter = ref({
    title: props.counter?.title ?? '',
    count: props.counter?.count ?? 0,
    color: (props.counter?.color ?? '#000000') as HexColor,
    type: props.counter?.type ?? ('PERSONAL' as CounterType),
});

const updateCounter = async () => {
    if (props.counter) {
        await counterStore.updateCounter(props.counter.id, { ...localCounter.value } as UpdateCounterRequest);
    } else {
        await counterStore.createCounter(
            localCounter.value.title,
            localCounter.value.color as HexColor,
            localCounter.value.type as CounterType,
        );
    }

    emit('done');
};
</script>

<template>
    <h1>{{ counter ? 'Update' : 'Create' }} Counter</h1>
    <form @submit.prevent="updateCounter()">
        <TextInput label="title" test-id="counter-title" v-model="localCounter.title" required />
        <label for="color">Color</label>
        <input type="color" id="color" v-model="localCounter.color" />
        <div class="share-section" v-if="!props.counter">
            <ion-item lines="none" class="toggle-item">
                <ion-label>
                    Enable Sharing
                    <p v-if="!authStore.isPremium" class="premium-note">
                        <ion-icon :icon="diamond" color="warning" />
                        Premium Feature
                    </p>
                </ion-label>
                <ion-toggle
                    :checked="localCounter.type === 'SHARED'"
                    :disabled="!authStore.isPremium"
                    @ionChange="localCounter.type = $event.detail.checked ? 'SHARED' : 'PERSONAL'"
                ></ion-toggle>
            </ion-item>
        </div>
        <BaseButton type="submit" test-id="counter-form-submit">{{ counter ? 'Update' : 'Create' }}</BaseButton>
    </form>
</template>

<style lang="scss" scoped></style>
