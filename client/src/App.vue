<script setup lang="ts">
import { onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { SplashScreen } from '@capacitor/splash-screen';
import { SyncManager } from '@/services/sync-manager';

onMounted(async () => {
    await SyncManager.init();
    await SplashScreen.hide();
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
