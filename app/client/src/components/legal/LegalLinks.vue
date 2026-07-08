<script setup lang="ts">
type LegalLink = {
    readonly label: string;
    readonly href: string;
};

const legalLinks = [
    { label: 'Privacy', href: '/legal-pages/privacy/index.html' },
    { label: 'Terms', href: '/legal-pages/terms/index.html' },
    { label: 'Support', href: '/legal-pages/support/index.html' },
] as const satisfies readonly LegalLink[];
</script>

<template>
    <nav class="legal-links" aria-label="Legal links">
        <a v-for="link in legalLinks" :key="link.href" :href="link.href" class="legal-link">
            {{ link.label }}
        </a>
    </nav>
</template>

<style scoped>
.legal-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.85rem;
    justify-content: center;
    margin-top: 1rem;
}

.legal-link {
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--ion-color-medium);
    text-decoration: underline;
    text-underline-offset: 0.2em;
}
</style>
