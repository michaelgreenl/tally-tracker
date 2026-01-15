import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/authStore.js';
import HomeView from '../views/HomeView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';

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

    if (!authStore.initLoading && authorized && !authStore.isAuthenticated) {
        await authStore.initializeAuth();
        authStore.initLoading = false;
    }

    if (!authStore.isAuthenticated && to.meta.requiresAuth) {
        next('/login');
    } else if ((to.name === 'Login' || to.name === 'Register') && authStore.isAuthenticated) {
        next('/profile');
    } else {
        next();
    }

    authStore.initLoading = false;
});

router.afterEach((to) => {
    const authStore = useAuthStore();

    let title = DEFAULT_TITLE;

    if (authStore.isAuthenticated) {
        title += ' | ' + authStore.user?.username;
    } else if (to.meta.title) {
        title += ' | ' + to.meta.title;
    }

    document.title = title;
});

export default router;
