<script setup lang="ts">
import { onMounted } from 'vue';
import { App as CapacitorApp } from '@capacitor/app';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { SplashScreen } from '@capacitor/splash-screen';
import { SyncManager } from '@/services/sync/manager';
import { useRouter } from 'vue-router';

import type { URLOpenListenerEvent } from '@capacitor/app';

const router = useRouter();

onMounted(async () => {
    await SyncManager.init();
    await SplashScreen.hide();

    CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        alert('Opened deep link');

        const url = new URL(event.url);
        if (url.host === 'join') {
            const code = url.searchParams.get('code');
            if (code) {
                router.push(`/join?code=${code}`);
            }
        }
    });
});
</script>

<template>
    <ion-app>
        <ion-router-outlet />
    </ion-app>
</template>

<style lang="scss">
* {
    box-sizing: border-box;
}

html,
body,
#app,
.app-container {
    font-size: 12px;
    min-height: 100vh;
    padding: 0;
    margin: 0;
    font-family: $primary-font-stack;
    background: $color-bg-primary;
}

#app {
    position: relative;
    display: flex;
    flex-direction: column;
}

main {
    @include flexCenterAll;
    flex-direction: column;
    height: 100%;
    gap: 1em;
}

button {
    cursor: pointer !important;
}

button:focus-visible {
    outline: 2px solid $color-primary;
}

a {
    text-decoration: none;
}

a:visted {
    color: inherit;
}
</style>
