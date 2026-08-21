<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { getErrorMessage } from '@/utils/errors';
import { IonPage, IonContent, IonGrid, IonRow, IonCol } from '@ionic/vue';
import TextInput from '@/components/inputs/TextInput.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseNavLink from '@/components/base/BaseNavLink.vue';
import LegalLinks from '@/components/legal/LegalLinks.vue';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');

const handleRegister = async () => {
    if (password.value !== confirmPassword.value) {
        errorMessage.value = "Passwords don't match";
        return;
    }

    if (!email.value.includes('@')) {
        errorMessage.value = 'Please enter a valid email address';
        return;
    }

    loading.value = true;
    errorMessage.value = '';

    try {
        const res = await authStore.register({ email: email.value, password: password.value });

        if (res.success) router.push('/login');
        else errorMessage.value = res.message || 'Registration failed';
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
                            <h1>Create Account</h1>
                            <p>Get started with Tally App</p>
                        </div>
                        <form @submit.prevent="handleRegister">
                            <TextInput
                                label="Email Address"
                                v-model="email"
                                type="email"
                                placeholder="name@example.com"
                            />
                            <TextInput
                                label="Password"
                                v-model="password"
                                type="password"
                                :show-password-toggle="true"
                                :is-password-visible="showPassword"
                                @toggle-password="showPassword = !showPassword"
                            />
                            <TextInput label="Confirm Password" v-model="confirmPassword" type="password" />
                            <div class="error-box" v-if="errorMessage">
                                {{ errorMessage }}
                            </div>
                            <BaseButton type="submit" :loading="loading">Register</BaseButton>
                            <div class="footer">
                                <BaseNavLink to="/login" direction="back">Already have an account?</BaseNavLink>
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
