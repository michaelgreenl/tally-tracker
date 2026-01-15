<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/Button.vue';
import TextInput from '@/components/Inputs/Text.vue';

const authStore = useAuthStore();

const username = ref('');
const password = ref('');
const errorMessage = ref<string | null>(null);
const isLoading = ref(false);
const showPassword = ref(false);
const passwordHideButton = ref(false);

const router = useRouter();

const handleLogin = async () => {
    errorMessage.value = null;
    isLoading.value = true;

    try {
        const success = await authStore.login(username.value, password.value);

        if (success) {
            router.push('/');
        } else {
            errorMessage.value = 'Invalid username or password.';
            password.value = '';
        }
    } catch (error) {
        errorMessage.value = 'An unexpected error occurred.';
        password.value = '';
        console.error(error);
    } finally {
        isLoading.value = false;
    }
};
</script>

<template>
    <div class="auth-container">
        <form class="auth-form" @submit.prevent="handleLogin">
            <div class="auth-header">
                <h2>Login</h2>
            </div>
            <hr class="header-border" />
            <div class="form-groups">
                <div class="form-group">
                    <label for="username">Username</label>
                    <TextInput id="username" v-model="username" required :disabled="isLoading" />
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <div class="password-input-wrapper">
                        <TextInput
                            id="password"
                            v-model="password"
                            required
                            :disabled="isLoading"
                            :show-password="showPassword"
                            :password-hide-button="passwordHideButton"
                            @toggle-hide-button="showPassword = !showPassword"
                            @focus="passwordHideButton = true"
                            @blur="passwordHideButton = false"
                        />
                    </div>
                </div>
            </div>
            <Button type="submit" text="Login" preset="secondary" :is-loading="isLoading" :disabled="isLoading" />
            <hr class="bottom-border" />
            <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
            <p class="form-link">Don't have an account? <router-link to="/register">Register</router-link></p>
        </form>
    </div>
</template>

<style lang="scss" scoped>
.auth-container {
    width: 100%;
    padding: 0 $size-4 $size-12;
    font-size: 0.8em;
    @include flexCenterAll;
}

.auth-form {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: $size-1;
    width: 90%;
    max-width: 30em;
    padding: $size-6 $size-7 0;
}

.auth-header {
    align-self: flex-start;
    @include flexCenterAll;

    h2 {
        margin: 0;
        font-size: 2.2em;
        color: $color-accent;
    }
}

.header-border {
    height: 2px;
    margin: 0 0 $size-1;
    background-color: $color-primary-light;
    border: 0;
}

.bottom-border {
    width: 90%;
    height: 1px;
    margin: $size-2 auto 0;
    background-color: $color-gray4;
    border: 0;
}

.form-groups {
    display: flex;
    flex-direction: column;
    gap: $size-3;
    padding: $size-1 $size-2 $size-2;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: $size-1;

    label {
        font-size: 0.9em;
        color: $color-text-secondary-dark;
    }
}

.password-input-wrapper {
    display: flex;
    align-items: center;

    :deep(input) {
        padding-right: 60px;
    }
}

button[type='submit'] {
    position: relative;
    z-index: 2;
    align-self: flex-end;
    margin-right: $size-4;

    :deep(span) {
        color: $color-white;
        text-shadow: none;
    }
}

.error-message {
    margin-top: $size-1;
    color: $color-error;
    text-align: center;
}

.form-link {
    margin-top: $size-2;
    color: $color-text-secondary-dark;
    text-align: center;

    a {
        color: $color-primary;

        &:hover {
            text-decoration: underline;
        }
    }
}
</style>
