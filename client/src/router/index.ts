import { createRouter, createWebHistory } from '@ionic/vue-router';
import { useAuthStore } from '@/stores/authStore';
import socket from '@/socket/index';
import HomeView from '@/views/HomeView.vue';
import LoginView from '@/views/LoginView.vue';
import RegisterView from '@/views/RegisterView.vue';
import JoinView from '@/views/JoinView.vue';

import type { RouteRecordRaw } from 'vue-router';

const DEFAULT_TITLE = 'Tally Tracker';

const routes: Array<RouteRecordRaw> = [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'Login', component: LoginView, meta: { title: 'Login' } },
    { path: '/register', name: 'Register', component: RegisterView, meta: { title: 'Register' } },
    { path: '/home', name: 'Home', component: HomeView },
    { path: '/join', name: 'Join', component: JoinView },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore();

    /**
     * AUTHORIZED is a localStorage flag set on login, used to trigger
     * initializeAuth on cold starts (page refresh, app reopen) without
     * requiring a server call just to decide whether to attempt auth.
     */
    const authorized = localStorage.getItem('AUTHORIZED');

    if (authorized && !authStore.isAuthenticated) {
        await authStore.initializeAuth();
    }

    if (!authStore.isAuthenticated && to.meta.requiresAuth) {
        next('/login');
    } else if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
        next('/home');
    } else {
        next();
    }
});

router.afterEach((to) => {
    const authStore = useAuthStore();

    // Re-join socket room on every navigation to handle reconnections and page refreshes
    if (authStore.isAuthenticated) {
        socket.emit('join-room', authStore.user?.id);
    }

    let title = DEFAULT_TITLE;
    if (to.meta.title) title += ' | ' + to.meta.title;

    document.title = title;
});

export default router;
