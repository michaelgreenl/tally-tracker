<script setup lang="ts">
import { ref } from 'vue';
import { useCounterStore } from '@/stores/counterStore';
import BaseButton from '@/components/base/BaseButton.vue';
import TextInput from '@/components/inputs/TextInput.vue';

import type { UpdateCounterRequest } from '@/types/shared/requests';
import type { ClientCounter } from '@/types/shared/models';
import type { HexColor } from '@/types/shared';

const props = defineProps<{
    counter?: ClientCounter;
}>();

const emit = defineEmits<{
    (e: 'done'): void;
}>();

const counterStore = useCounterStore();

const localCounter = ref({
    title: props.counter?.title ?? '',
    count: props.counter?.count ?? 0,
    color: (props.counter?.color ?? '#000000') as HexColor,
});

const updateCounter = async () => {
    if (props.counter) {
        await counterStore.updateCounter(props.counter.id, { ...localCounter.value } as UpdateCounterRequest);
    } else {
        await counterStore.createCounter(localCounter.value.title, localCounter.value.color as HexColor);
    }

    emit('done');
};
</script>

<template>
    <h1>{{ counter ? 'Update' : 'Create' }} Counter</h1>
    <form @submit.prevent="updateCounter()">
        <TextInput label="title" v-model="localCounter.title" required />
        <label v-if="props.counter" for="count">Count</label>
        <input v-if="props.counter" type="number" id="count" v-model="localCounter.count" />
        <label for="color">Count</label>
        <input type="color" id="color" v-model="localCounter.color" />
        <BaseButton type="submit">{{ counter ? 'Update' : 'Create' }}</BaseButton>
    </form>
</template>

<style lang="scss" scoped></style>
