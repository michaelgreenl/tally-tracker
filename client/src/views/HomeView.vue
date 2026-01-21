<script setup lang="ts">
import { ref, onMounted } from 'vue';
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

onMounted(async () => {
    if (authStore.isAuthenticated) {
        await counterStore.getAllCounters();
    }
});

const updateCounter = async (counter: ClientCounter) => {
    counterToUpdate.value = counter;
    showCounterForm.value = true;
};

const closeCounterForm = () => {
    counterToUpdate.value = null;
    showCounterForm.value = false;
};
</script>

<template>
    <ion-page v-if="!authStore.initLoading">
        <ion-header>
            <ion-toolbar color="primary">
                <ion-title>Tally Counter</ion-title>
                <ion-buttons v-if="authStore.isAuthenticated" slot="end">
                    <ion-button @click="authStore.logout()">Logout</ion-button>
                </ion-buttons>
            </ion-toolbar>
        </ion-header>
        <ion-content v-if="authStore.isAuthenticated" class="ion-padding">
            <h2>Welcome to Tally Counter!</h2>
            <ion-list v-if="counterStore.counters.length">
                <ion-item v-for="counter in counterStore.counters" :key="counter.id">
                    <div :style="{ display: 'flex', gap: '20px' }">
                        <h1>{{ counter.title }}</h1>
                        <p>{{ counter.count }}</p>
                        <p>{{ counter.color }}</p>
                        <BaseButton @click="counterStore.deleteCounter(counter.id)">delete</BaseButton>
                        <BaseButton @click="counterStore.incrementCounter(counter.id, -1)">-1</BaseButton>
                        <BaseButton @click="counterStore.incrementCounter(counter.id, 1)">+1</BaseButton>
                        <BaseButton @click="updateCounter(counter)">update</BaseButton>
                    </div>
                </ion-item>
            </ion-list>
            <p v-else>No counter's yet.</p>
            <BaseButton v-if="!showCounterForm" @click="showCounterForm = true">Add counter</BaseButton>
            <CounterForm
                v-if="showCounterForm"
                :counter="counterToUpdate as ClientCounter | undefined"
                @done="closeCounterForm()"
            />
            <BaseButton v-if="showCounterForm" @click="closeCounterForm()">Cancel</BaseButton>
        </ion-content>
        <ion-content v-else class="ion-padding">
            <ion-list>
                <ion-item>
                    <BaseNavLink to="/login">Login</BaseNavLink>
                </ion-item>
                <ion-item>
                    <BaseNavLink to="/register">Register</BaseNavLink>
                </ion-item>
            </ion-list>
        </ion-content>
    </ion-page>
    <ion-page v-else>
        <h1>Loading...</h1>
    </ion-page>
</template>

<style lang="scss" scoped></style>
