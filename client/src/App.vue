<template>
    <ion-app>
        <ion-router-outlet />
    </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
</script>

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
    font-size: 8px;

    @include bp-xs-phone {
        font-size: 10px;
    }

    @include bp-sm-phone {
        font-size: 12px;
    }

    @include bp-md-tablet {
        font-size: 14px;
    }

    @include bp-xxl-desktop {
        font-size: 16px;
    }
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
