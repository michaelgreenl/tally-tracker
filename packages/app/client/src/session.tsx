import { UNAUTHORIZED } from '@tally/core/client';
import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { ApiError, getErrorMessage, setUnauthorizedHandler } from './api';
import { AuthService } from './services/auth.service';
import { billingApiKey, BillingService } from './services/billing.service';

import type { AuthRequest, ClientUser, UpdateUserRequest } from '@tally/core/client';
import type { PropsWithChildren } from 'react';

type ActionResult = { success: true } | { success: false; message: string };

type SessionContextValue = {
    user: ClientUser | null;
    ready: boolean;
    isAuthenticated: boolean;
    isPremium: boolean;
    login: (request: AuthRequest) => Promise<ActionResult>;
    register: (request: AuthRequest) => Promise<ActionResult>;
    logout: () => Promise<ActionResult>;
    deleteAccount: () => Promise<ActionResult>;
    updateUser: (request: UpdateUserRequest) => Promise<ActionResult>;
    refreshPurchases: () => Promise<ClientUser>;
};

const SessionContext = createContext<SessionContextValue | null>(null);
const ok = (): ActionResult => ({ success: true });
const fail = (message: string): ActionResult => ({ success: false, message });

export async function restoreSession(): Promise<ClientUser | null> {
    let cachedUser: ClientUser | null;

    try {
        cachedUser = await AuthService.getCachedUser();
    } catch {
        await AuthService.clearLocalAuth();
        return null;
    }

    if (!cachedUser) return null;

    if (Platform.OS !== 'web') {
        let accessToken: string | null;
        let refreshToken: string | null;

        try {
            [accessToken, refreshToken] = await Promise.all([
                AuthService.getAccessToken(),
                AuthService.getRefreshToken(),
            ]);
        } catch {
            return null;
        }

        if (!accessToken && !refreshToken) {
            await AuthService.clearLocalAuth();
            return null;
        }
    }

    try {
        const response = await AuthService.checkAuth();
        const verifiedUser = response.data?.user;

        if (response.success && verifiedUser) {
            await AuthService.cacheUser(verifiedUser);
            return verifiedUser;
        }
    } catch (error: unknown) {
        if (error instanceof ApiError && error.status === UNAUTHORIZED) {
            await AuthService.clearLocalAuth();
            return null;
        }
    }

    return cachedUser;
}

export function SessionProvider({ children }: PropsWithChildren) {
    const router = useRouter();
    const [user, updateUserState] = useState<ClientUser | null>(null);
    const [ready, setReady] = useState(false);
    const userRef = useRef<ClientUser | null>(null);
    const setUser = useCallback((value: ClientUser | null) => {
        userRef.current = value;
        updateUserState(value);
    }, []);

    const clearSession = useCallback(async () => {
        setUser(null);
        await AuthService.clearLocalAuth();
    }, [setUser]);

    const refreshPurchases = useCallback(async () => {
        const userId = userRef.current?.id;
        if (!userId) throw new Error('Sign in to verify purchases.');
        await BillingService.sync();
        const response = await AuthService.checkAuth();
        const verifiedUser = response.data?.user;
        if (!response.success || !verifiedUser || verifiedUser.id !== userId || userRef.current?.id !== userId) {
            throw new Error('The account changed. Sign in again to verify purchases.');
        }
        await AuthService.cacheUser(verifiedUser);
        if (userRef.current?.id !== userId) {
            await AuthService.cacheUser(userRef.current);
            throw new Error('The account changed. Sign in again to verify purchases.');
        }
        setUser(verifiedUser);
        return verifiedUser;
    }, [setUser]);

    useEffect(() => {
        if (!user?.id || !billingApiKey()) return;
        let active = true;
        let refreshing = false;
        let unsubscribe: (() => void) | undefined;
        const refresh = async () => {
            if (!active || refreshing) return;
            refreshing = true;
            try {
                await refreshPurchases();
            } catch {
                // Keep the last verified profile offline. Explicit purchase/restore actions report failures.
            } finally {
                refreshing = false;
            }
        };
        void BillingService.subscribe(user.id, () => void refresh())
            .then((remove) => {
                if (active) {
                    unsubscribe = remove;
                    void refresh();
                } else remove();
            })
            .catch(() => undefined);
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void refresh();
        });
        return () => {
            active = false;
            unsubscribe?.();
            subscription.remove();
        };
    }, [user?.id, refreshPurchases]);

    useEffect(() => {
        return setUnauthorizedHandler(async () => {
            await clearSession();
            router.replace('/login');
        });
    }, [clearSession, router]);

    useEffect(() => {
        let active = true;

        void restoreSession()
            .then((restoredUser) => {
                if (active) setUser(restoredUser);
            })
            .catch(() => {
                if (active) setUser(null);
            })
            .finally(() => {
                if (active) setReady(true);
            });

        return () => {
            active = false;
        };
    }, [setUser]);

    async function login(request: AuthRequest): Promise<ActionResult> {
        try {
            const response = await AuthService.login({
                ...request,
                rememberMe: Platform.OS === 'web' ? request.rememberMe : true,
            });
            const authenticatedUser = response.data?.user;

            if (!response.success || !authenticatedUser) return fail(response.message || 'Login Failed');

            const writes = [AuthService.cacheUser(authenticatedUser)];
            if (response.data?.accessToken) writes.push(AuthService.setAccessToken(response.data.accessToken));
            if (response.data?.refreshToken) writes.push(AuthService.setRefreshToken(response.data.refreshToken));
            await Promise.all(writes);
            setUser(authenticatedUser);
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Login Failed'));
        }
    }

    async function register(request: AuthRequest): Promise<ActionResult> {
        if (!request.email) return fail('Registration requires email as input');

        try {
            const response = await AuthService.register(request);
            return response.success ? ok() : fail(response.message || 'Registration failed');
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Registration failed'));
        }
    }

    async function logout(): Promise<ActionResult> {
        try {
            await AuthService.logout();
        } catch (error: unknown) {
            console.warn('Server logout failed', error);
        } finally {
            await clearSession();
            router.replace('/login');
        }

        return ok();
    }

    async function deleteAccount(): Promise<ActionResult> {
        try {
            const response = await AuthService.deleteAccount();
            if (!response.success) return fail(response.message || 'Failed to delete account');

            await clearSession();
            router.replace('/login');
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to delete account'));
        }
    }

    async function updateUser(request: UpdateUserRequest): Promise<ActionResult> {
        if (!user) return fail('No authenticated user');

        try {
            const response = await AuthService.updateUser(request);
            if (!response.success) return fail(response.message || 'Failed to update user');

            const { password: _, ...updates } = request;
            const updatedUser = {
                ...user,
                ...updates,
                emailVerified: request.email === user.email ? user.emailVerified : false,
            };
            await AuthService.cacheUser(updatedUser);
            setUser(updatedUser);
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to update user'));
        }
    }

    return (
        <SessionContext.Provider
            value={{
                user,
                ready,
                isAuthenticated: Boolean(user),
                isPremium: user?.tier === 'PREMIUM',
                login,
                register,
                logout,
                deleteAccount,
                updateUser,
                refreshPurchases,
            }}
        >
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const session = useContext(SessionContext);
    if (!session) throw new Error('useSession must be used inside SessionProvider');
    return session;
}
