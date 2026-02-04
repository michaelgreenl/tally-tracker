import { createRouter, createWebHistory } from '@ionic/vue-router';
import { useAuthStore } from '@/stores/authStore';
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
    const authorized = localStorage.getItem('AUTHORIZED');

    if (authorized && !authStore.isAuthenticated) {
        await authStore.initializeAuth();
    }

    if (!authStore.isAuthenticated && to.meta.requiresAuth) {
        next('/login');
    } else if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
        next('/home');
    }

    next();
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
