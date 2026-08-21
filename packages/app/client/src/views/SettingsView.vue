<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonPage,
    IonTitle,
    IonToolbar,
} from '@ionic/vue';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseModal from '@/components/base/BaseModal.vue';
import { useAuthStore } from '@/stores/authStore';

type LegalLink = {
    readonly label: string;
    readonly href: string;
};

const legalLinks = [
    { label: 'Privacy Policy', href: '/legal-pages/privacy/index.html' },
    { label: 'Terms of Service', href: '/legal-pages/terms/index.html' },
    { label: 'Support/contact', href: '/legal-pages/support/index.html' },
] as const satisfies readonly LegalLink[];

const authStore = useAuthStore();

const showDeleteConfirm = shallowRef(false);
const deleteLoading = shallowRef(false);
const deleteErrorMessage = shallowRef('');
const isSignedIn = computed(() => authStore.isAuthenticated);
const emailLabel = computed(() => authStore.user?.email ?? 'Unknown account');
const tierLabel = computed(() => {
    if (!authStore.user?.tier) return 'Unknown';

    return authStore.user.tier === 'PREMIUM' ? 'Premium' : 'Basic';
});
const subscriptionLabel = computed(() => {
    if (!isSignedIn.value) return 'Sign in to view subscription status';

    return authStore.isPremium ? 'Premium access is active' : 'No paid subscription';
});

const handleLogout = async () => {
    await authStore.logout();
};

const openDeleteConfirm = () => {
    deleteErrorMessage.value = '';
    showDeleteConfirm.value = true;
};

const closeDeleteConfirm = () => {
    if (deleteLoading.value) return;
    showDeleteConfirm.value = false;
};

const handleDeleteAccount = async () => {
    deleteLoading.value = true;
    deleteErrorMessage.value = '';

    const res = await authStore.deleteAccount();
    if (!res.success) {
        deleteErrorMessage.value = res.message || 'Failed to delete account';
        deleteLoading.value = false;
        return;
    }

    showDeleteConfirm.value = false;
    deleteLoading.value = false;
};
</script>

<template>
    <ion-page>
        <ion-header>
            <ion-toolbar color="primary">
                <ion-buttons slot="start">
                    <ion-back-button default-href="/home" text="Back" />
                </ion-buttons>
                <ion-title>Settings</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content class="settings-page ion-padding">
            <div class="settings-content">
                <section class="settings-section" aria-labelledby="settings-account-title">
                    <h2 id="settings-account-title" class="settings-section-title">Account</h2>
                    <ion-list class="settings-list">
                        <template v-if="isSignedIn">
                            <ion-item>
                                <ion-label>Email</ion-label>
                                <ion-note slot="end">{{ emailLabel }}</ion-note>
                            </ion-item>
                            <ion-item>
                                <ion-label>Tier</ion-label>
                                <ion-note slot="end">{{ tierLabel }}</ion-note>
                            </ion-item>
                            <ion-item button data-testid="settings-logout" @click="handleLogout">
                                <ion-label>Logout</ion-label>
                            </ion-item>
                        </template>
                        <template v-else>
                            <ion-item>
                                <ion-label>
                                    <h3 class="settings-row-title">Guest mode</h3>
                                    <p class="settings-row-detail">
                                        Sign in to sync counters, view account status, and manage account options.
                                    </p>
                                </ion-label>
                            </ion-item>
                            <ion-item>
                                <ion-label>Account access</ion-label>
                                <div slot="end" class="account-actions">
                                    <ion-button size="small" router-link="/login">Log in</ion-button>
                                    <ion-button size="small" fill="outline" router-link="/register">Sign up</ion-button>
                                </div>
                            </ion-item>
                        </template>
                    </ion-list>
                </section>

                <section class="settings-section" aria-labelledby="settings-subscription-title">
                    <h2 id="settings-subscription-title" class="settings-section-title">Subscription</h2>
                    <ion-list class="settings-list">
                        <ion-item>
                            <ion-label>
                                <h3 class="settings-row-title">Manage subscription</h3>
                                <p class="settings-row-detail">{{ subscriptionLabel }}</p>
                            </ion-label>
                            <ion-note slot="end">{{ isSignedIn ? 'Coming later' : 'Unavailable' }}</ion-note>
                        </ion-item>
                    </ion-list>
                </section>

                <section class="settings-section" aria-labelledby="settings-legal-title">
                    <h2 id="settings-legal-title" class="settings-section-title">Legal</h2>
                    <ion-list class="settings-list">
                        <ion-item v-for="link in legalLinks" :key="link.href" button detail :href="link.href">
                            <ion-label>{{ link.label }}</ion-label>
                        </ion-item>
                    </ion-list>
                </section>

                <section v-if="isSignedIn" class="settings-section" aria-labelledby="settings-danger-title">
                    <h2 id="settings-danger-title" class="settings-section-title">Danger zone</h2>
                    <ion-list class="settings-list">
                        <ion-item button data-testid="settings-delete-account" @click="openDeleteConfirm">
                            <ion-label color="danger">Delete account</ion-label>
                        </ion-item>
                    </ion-list>
                </section>
            </div>

            <BaseModal
                test-id="delete-account-confirm"
                :is-open="showDeleteConfirm"
                title="Delete account?"
                dismiss-label="Cancel"
                @close="closeDeleteConfirm"
            >
                <p class="delete-copy">
                    This permanently deletes your account and server-side account data. This action cannot be undone.
                </p>
                <p v-if="deleteErrorMessage" class="delete-error">{{ deleteErrorMessage }}</p>
                <BaseButton color="danger" :loading="deleteLoading" @click="handleDeleteAccount">
                    Delete account
                </BaseButton>
            </BaseModal>
        </ion-content>
    </ion-page>
</template>

<style lang="scss" scoped>
.settings-content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
    max-width: 680px;
    margin: 0 auto;
}

.settings-section-title {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-primary-light);
}

.settings-list {
    overflow: hidden;
    border: 1px solid var(--color-gray6);
    border-radius: 8px;
}

.settings-row-title {
    margin: 0 0 0.2rem;
    font-size: 1rem;
    font-weight: 600;
}

.settings-row-detail {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-text-secondary-light);
}

.account-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-end;
}

.delete-copy,
.delete-error {
    margin-top: 0;
    line-height: 1.5;
    color: var(--ion-color-danger);
}
</style>
