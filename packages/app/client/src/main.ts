/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

// Ionic Dark Mode
// For more info, please see:
// https://ionicframework.com/docs/theming/dark-mode
// @import '@ionic/vue/css/palettes/dark.always.css';
// @import '@ionic/vue/css/palettes/dark.class.css';
import '@ionic/vue/css/palettes/dark.system.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { setUnauthorizedHandler } from './api.ts';
import router from './router';
import socket from './socket/index.ts';
import { registerCounterListeners } from './socket/counter.socket.ts';
import { useAuthStore } from './stores/authStore.ts';
import { useCounterStore } from './stores/counterStore.ts';
import App from './App.vue';
import { IonicVue } from '@ionic/vue';
import { initSentry } from './monitoring/sentry';

const pinia = createPinia();
const app = createApp(App).use(IonicVue).use(pinia).use(router);
const authStore = useAuthStore(pinia);
const counterStore = useCounterStore(pinia);

initSentry(app);
setUnauthorizedHandler(async () => {
    await authStore.logout(false);
});
registerCounterListeners(socket, counterStore.applyRemoteUpdate);

router.isReady().then(() => {
    app.mount('#app');
});
