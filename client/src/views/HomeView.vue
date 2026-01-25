<script setup lang="ts">
import { ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import { useAuthStore } from '@/stores/authStore';
import { useCounterStore } from '@/stores/counterStore';
import { useRouter } from 'vue-router';
import BaseNavLink from '@/components/base/BaseNavLink.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import TextInput from '@/components/inputs/TextInput.vue';
import CounterForm from '@/components/CounterForm.vue';
import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButtons,
    IonButton,
} from '@ionic/vue';

import type { HexColor } from '@/types/shared';
import type { ClientCounter } from '@/types/shared/models';

const authStore = useAuthStore();
const counterStore = useCounterStore();
const router = useRouter();

const showCounterForm = ref(false);
const counterToUpdate = ref<ClientCounter | null>(null);

onIonViewWillEnter(async () => {
    await counterStore.getAllCounters();
});

const startUpdateCounter = async (counter: ClientCounter) => {
    counterToUpdate.value = counter;
    showCounterForm.value = true;
};

const closeCounterForm = () => {
    counterToUpdate.value = null;
    showCounterForm.value = false;
};
</script>

<template>
    <ion-page>
        <ion-header>
            <ion-toolbar color="primary">
                <ion-title>Tally Counter</ion-title>
                <ion-buttons slot="end">
                    <ion-button v-if="authStore.isAuthenticated" @click="authStore.logout()">Logout</ion-button>
                    <ion-button v-else @click="router.push('/login')">Login / Sync</ion-button>
                </ion-buttons>
            </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
            <h2>Welcome {{ authStore.isAuthenticated ? authStore.user?.email : 'Guest' }}!</h2>
            <ion-list v-if="counterStore.counters.length">
                <ion-item v-for="counter in counterStore.counters" :key="counter.id">
                    <div :style="{ display: 'flex', gap: '20px' }">
                        <h1>{{ counter.title }}</h1>
                        <p>{{ counter.count }}</p>
                        <p>{{ counter.color }}</p>
                        <BaseButton @click="counterStore.deleteCounter(counter.id)">delete</BaseButton>
                        <BaseButton @click="counterStore.incrementCounter(counter.id, -1)">-1</BaseButton>
                        <BaseButton @click="counterStore.incrementCounter(counter.id, 1)">+1</BaseButton>
                        <BaseButton @click="startUpdateCounter(counter)">edit</BaseButton>
                    </div>
                </ion-item>
            </ion-list>
            <p v-else>No counter's yet.</p>
            <BaseButton v-if="!showCounterForm" @click="showCounterForm = true">Add counter</BaseButton>
            <template v-else>
                <CounterForm :counter="counterToUpdate as ClientCounter | undefined" @done="closeCounterForm()" />
                <BaseButton @click="closeCounterForm()">Cancel</BaseButton>
            </template>
        </ion-content>
    </ion-page>
</template>

<style lang="scss" scoped></style>
