<script setup lang="ts">
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue';

const router = useRouter();
</script>

<template>
    <ion-page>
        <ion-header>
            <ion-toolbar color="primary">
                <ion-title>Upgrade</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
            <div class="page" data-testid="upgrade-placeholder-page">
                <h1>Upgrade is coming later</h1>
                <p>This page is informational only. Upgrade and billing functionality are not implemented yet.</p>
                <p>You cannot purchase or unlock premium access from this screen in this run.</p>
                <BaseButton test-id="upgrade-placeholder-back" @click="router.replace('/home')"
                    >Back to home</BaseButton
                >
            </div>
        </ion-content>
    </ion-page>
</template>

<style scoped>
.page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 600px;
    margin: 0 auto;
}

.page h1,
.page p {
    margin: 0;
}

.page p {
    line-height: 1.5;
}
</style>
