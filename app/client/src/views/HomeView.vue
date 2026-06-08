<script setup lang="ts">
import { ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useCounterStore } from '@/stores/counterStore';
import { useNetwork } from '@/composables/useNetwork';
import { useSync } from '@/composables/useSync';
import { cloudDoneOutline, cloudOfflineOutline, diamond } from 'ionicons/icons';

import BaseButton from '@/components/base/BaseButton.vue';
import Counter from '@/components/counter/Counter.vue';
import CounterForm from '@/components/counter/CounterForm.vue';
import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonButtons,
    IonButton,
    IonIcon,
    IonSpinner,
} from '@ionic/vue';

import type { ClientCounter } from '@packages/core';

const authStore = useAuthStore();
const counterStore = useCounterStore();
const router = useRouter();

const showCounterForm = ref(false);
const counterToUpdate = ref<ClientCounter | null>(null);

const { isOnline } = useNetwork();
const { isSyncing } = useSync();

onIonViewWillEnter(async () => {
    await counterStore.init();
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
                <ion-title>
                    <div class="title-wrapper">
                        Tally Counter
                        <ion-icon v-if="authStore.isPremium" :icon="diamond" color="light" />
                    </div>
                </ion-title>

                <ion-buttons slot="end">
                    <ion-button v-if="authStore.isAuthenticated" @click="authStore.logout()">Logout</ion-button>
                    <ion-button v-else @click="router.push('/login')">Login</ion-button>
                </ion-buttons>
            </ion-toolbar>
        </ion-header>
        <ion-content class="ion-content ion-padding">
            <div class="content-wrapper">
                <div class="content-header">
                    <h2>Welcome {{ authStore.isAuthenticated ? authStore.user?.email : 'Guest' }}!</h2>

                    <template v-if="authStore.isAuthenticated">
                        <ion-spinner v-if="isSyncing" name="crescent" :style="{ width: '20px', height: '20px' }" />
                        <ion-icon v-else-if="!isOnline" :icon="cloudOfflineOutline" color="dark" />
                        <ion-icon v-else :icon="cloudDoneOutline" color="dark" />
                    </template>
                </div>

                <ion-list v-if="counterStore.counters.length">
                    <ion-item v-for="counter in counterStore.counters" :key="counter.id">
                        <Counter
                            :counter="counter"
                            @delete="counterStore.deleteCounter"
                            @increment="counterStore.incrementCounter"
                            @showUpdateForm="startUpdateCounter"
                        />
                    </ion-item>
                </ion-list>

                <p v-else>No counter's yet.</p>
                <BaseButton v-if="!showCounterForm" @click="showCounterForm = true">Add counter</BaseButton>
                <template v-else>
                    <CounterForm :counter="counterToUpdate ?? undefined" @done="closeCounterForm()" />
                    <BaseButton @click="closeCounterForm()">Cancel</BaseButton>
                </template>
            </div>
        </ion-content>
    </ion-page>
</template>

<style lang="scss" scoped>
.title-wrapper {
    display: flex;
    gap: 0.5em;
    align-items: center;
}

.content-wrapper {
    max-width: 600px;
    margin: 0 auto;
}

.content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding-right: 1em;
}
</style>
