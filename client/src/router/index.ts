import { createRouter, createWebHistory } from '@ionic/vue-router';
import { useAuthStore } from '@/stores/authStore.js';
import HomeView from '@/views/HomeView.vue';
import LoginView from '@/views/LoginView.vue';
import RegisterView from '@/views/RegisterView.vue';

import type { RouteRecordRaw } from 'vue-router';

const DEFAULT_TITLE = 'Ionic Vue Template';

const routes: Array<RouteRecordRaw> = [
    { path: '/', component: HomeView },
    { path: '/login', name: 'Login', component: LoginView, meta: { title: 'Login' } },
    { path: '/register', name: 'Register', component: RegisterView, meta: { title: 'Register' } },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore();
    const authorized = localStorage.getItem('AUTHORIZED');

    if (authorized && !authStore.isAuthenticated) {
        await authStore.initializeAuth();
        authStore.initLoading = false;
    }

    if (!authStore.isAuthenticated && to.meta.requiresAuth) {
        next('/login');
    }

    next();
    authStore.initLoading = false;
});

router.afterEach((to) => {
    const authStore = useAuthStore();

    let title = DEFAULT_TITLE;

    if (to.meta.title) {
        title += ' | ' + to.meta.title;
    }

    document.title = title;
});

export default router;
