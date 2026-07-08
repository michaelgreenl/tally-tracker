<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/utils/errors';
import { IonPage, IonContent, IonGrid, IonRow, IonCol, IonItem, IonLabel, IonToggle } from '@ionic/vue';
import TextInput from '@/components/inputs/TextInput.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseNavLink from '@/components/base/BaseNavLink.vue';
import LegalLinks from '@/components/legal/LegalLinks.vue';

const authStore = useAuthStore();
const router = useRouter();

const isNative = Capacitor.isNativePlatform();

const email = ref('');
const password = ref('');
const rememberMe = ref(false);
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');

const handleLogin = async () => {
    loading.value = true;
    errorMessage.value = '';

    try {
        const res = await authStore.login({
            email: email.value,
            password: password.value,
            rememberMe: rememberMe.value,
        });

        if (res.success) router.push('/home');
        else errorMessage.value = res.message || 'Login Failed';
    } catch (error: unknown) {
        errorMessage.value = getErrorMessage(error, 'Server error occurred');
        console.error('Server error occurred', error);
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <ion-page>
        <ion-content class="ion-padding">
            <ion-grid style="height: 100%">
                <ion-row class="ion-justify-content-center ion-align-items-center" style="height: 100%">
                    <ion-col size="12" size-md="6" size-lg="4">
                        <div class="header">
                            <h1>Welcome to Tally Tracker</h1>
                            <BaseNavLink to="/home">Continue as guest</BaseNavLink>
                        </div>
                        <form @submit.prevent="handleLogin">
                            <TextInput
                                label="Email Address"
                                v-model="email"
                                type="email"
                                :disabled="loading"
                                placeholder="name@example.com"
                            />
                            <TextInput
                                label="Password"
                                v-model="password"
                                type="password"
                                :disabled="loading"
                                :show-password-toggle="true"
                                :is-password-visible="showPassword"
                                @toggle-password="showPassword = !showPassword"
                            />
                            <ion-item v-if="!isNative" lines="none" class="remember-me">
                                <ion-label>Remember me</ion-label>
                                <ion-toggle v-model="rememberMe" :disabled="loading" />
                            </ion-item>
                            <div class="error-box" v-if="errorMessage">
                                {{ errorMessage }}
                            </div>
                            <BaseButton type="submit" :loading="loading">Login</BaseButton>
                            <div class="footer">
                                <BaseNavLink to="/register">Create an account</BaseNavLink>
                                <LegalLinks />
                            </div>
                        </form>
                    </ion-col>
                </ion-row>
            </ion-grid>
        </ion-content>
    </ion-page>
</template>

<style scoped>
.header {
    margin-bottom: 30px;
    text-align: center;
}

.header h1 {
    margin-bottom: 5px;
    font-size: 2rem;
    font-weight: bold;
}

.header p {
    color: #666;
}

.remember-me {
    --padding-start: 0;

    margin-bottom: 20px;
}

.footer {
    margin-top: 20px;
    text-align: center;
}

.footer a {
    font-weight: bold;
    color: var(--ion-color-primary);
    text-decoration: none;
}

.error-box {
    padding: 10px;
    margin-bottom: 20px;
    color: var(--ion-color-danger);
    text-align: center;
    background: rgb(var(--ion-color-danger-rgb), 0.1);
    border-radius: 8px;
}
</style>
