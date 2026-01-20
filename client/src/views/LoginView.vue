<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { IonPage, IonContent, IonGrid, IonRow, IonCol } from '@ionic/vue';
import TextInput from '@/components/inputs/TextInput.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseNavLink from '@/components/base/BaseNavLink.vue';

const authStore = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');

const handleLogin = async () => {
    isLoading.value = true;
    errorMessage.value = '';

    try {
        const res = await authStore.login({ email: email.value, password: password.value });

        if (res.success) router.push('/');
        else errorMessage.value = res.message || 'Login Failed';
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
                            <h1>Welcome Back</h1>
                            <p>Please login to continue</p>
                        </div>
                        <form @submit.prevent="handleLogin">
                            <TextInput
                                label="Email Address"
                                v-model="email"
                                type="email"
                                :disabled="isLoading"
                                placeholder="name@example.com"
                            />
                            <TextInput
                                label="Password"
                                v-model="password"
                                type="password"
                                :disabled="isLoading"
                                :show-password-toggle="true"
                                :is-password-visible="showPassword"
                                @toggle-password="showPassword = !showPassword"
                            />
                            <div class="error-box" v-if="errorMessage">
                                {{ errorMessage }}
                            </div>
                            <BaseButton type="submit" :loading="isLoading">Login</BaseButton>
                            <div class="footer">
                                <BaseNavLink to="/register">Create an account</BaseNavLink>
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

.header h1 {
    font-size: 2rem;
    font-weight: bold;
    margin-bottom: 5px;
}

.header p {
    color: #666;
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
    text-align: center;
    margin-bottom: 20px;
    background: rgba(var(--ion-color-danger-rgb), 0.1);
    padding: 10px;
    border-radius: 8px;
}
</style>
