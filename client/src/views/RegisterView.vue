<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonGrid, IonRow, IonCol } from '@ionic/vue';
import TextInput from '@/components/inputs/TextInput.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseNavLink from '@/components/base/BaseNavLink.vue';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
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

    isLoading.value = true;
    errorMessage.value = '';

    try {
        const res = await authStore.register({ email: email.value, password: password.value });

        if (res.success) router.push('/login');
        else errorMessage.value = res.message || 'Registration failed';
    } catch (error: any) {
        errorMessage.value = 'Server error occurred';
        console.error('Server error occurred', error);
    } finally {
        isLoading.value = false;
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
                            <BaseButton type="submit" :loading="isLoading">Register</BaseButton>
                            <div class="footer">
                                <BaseNavLink to="/login" direction="back">Already have an account?</BaseNavLink>
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
    text-align: center;
    margin-bottom: 30px;
}

.footer {
    text-align: center;
    margin-top: 20px;
}

.footer a {
    text-decoration: none;
    font-weight: bold;
    color: var(--ion-color-primary);
}

.error-box {
    color: var(--ion-color-danger);
    background: rgba(var(--ion-color-danger-rgb), 0.1);
    padding: 10px;
    border-radius: 8px;
    margin-bottom: 20px;
    text-align: center;
}
</style>
