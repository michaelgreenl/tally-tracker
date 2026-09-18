import { UNAUTHORIZED } from '@tally/core/client';
import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { ApiError, getErrorMessage, setUnauthorizedHandler } from './api';
import { AuthService, USER_KEY } from './services/auth.service';
import { billingApiKey, BillingService } from './services/billing.service';
import { assertSession, changeSession, getSessionScope, SessionChangedError } from './services/session-scope';

import type { AuthRequest, ClientUser } from '@tally/core/client';
import type { PropsWithChildren } from 'react';

type ActionResult = { success: true } | { success: false; message: string };

type SessionContextValue = {
    sessionId: number;
    user: ClientUser | null;
    ready: boolean;
    isAuthenticated: boolean;
    isPremium: boolean;
    login: (request: AuthRequest) => Promise<ActionResult>;
    register: (request: AuthRequest) => Promise<ActionResult>;
    logout: () => Promise<ActionResult>;
    deleteAccount: () => Promise<ActionResult>;
    refreshPurchases: () => Promise<ClientUser>;
    notice: string;
    dismissNotice: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);
const ok = (): ActionResult => ({ success: true });
const fail = (message: string): ActionResult => ({ success: false, message });

export async function restoreSession(): Promise<ClientUser | null> {
    const scope = getSessionScope();
    let cachedUser: ClientUser | null;

    try {
        cachedUser = await AuthService.getCachedUser();
        assertSession(scope);
    } catch (error) {
        if (error instanceof SessionChangedError) throw error;
        await AuthService.clearLocalAuth(scope);
        return null;
    }

    if (!cachedUser) return null;
    scope.userId = cachedUser.id;

    if (Platform.OS !== 'web') {
        let accessToken: string | null;
        let refreshToken: string | null;

        try {
            [accessToken, refreshToken] = await Promise.all([
                AuthService.getAccessToken(),
                AuthService.getRefreshToken(),
            ]);
        } catch {
            assertSession(scope);
            return null;
        }

        assertSession(scope);
        if (!accessToken && !refreshToken) {
            await AuthService.clearLocalAuth(scope);
            return null;
        }
    }

    try {
        const response = await AuthService.checkAuth();
        const verifiedUser = response.data?.user;

        if (response.success && verifiedUser && verifiedUser.id === cachedUser.id) {
            await AuthService.cacheUser(verifiedUser, scope);
            return verifiedUser;
        }
        await AuthService.clearLocalAuth(scope);
        return null;
    } catch (error: unknown) {
        if (error instanceof SessionChangedError) throw error;
        if (error instanceof ApiError && error.status === UNAUTHORIZED) {
            await AuthService.clearLocalAuth(scope);
            return null;
        }
    }

    assertSession(scope);
    return cachedUser;
}

export function SessionProvider({ children }: PropsWithChildren) {
    const router = useRouter();
    const [sessionId, setSessionId] = useState(getSessionScope().id);
    const [user, updateUserState] = useState<ClientUser | null>(null);
    const [ready, setReady] = useState(false);
    const [notice, setNotice] = useState('');
    const userRef = useRef<ClientUser | null>(null);
    const setUser = useCallback((value: ClientUser | null) => {
        userRef.current = value;
        updateUserState(value);
    }, []);

    const clearSession = useCallback(async () => {
        const scope = changeSession();
        setSessionId(scope.id);
        setUser(null);
        await AuthService.clearLocalAuth(scope);
    }, [setUser]);

    const refreshPurchases = useCallback(async () => {
        const scope = getSessionScope();
        const userId = userRef.current?.id;
        if (!userId) throw new Error('Sign in to verify purchases.');
        await BillingService.sync();
        assertSession(scope);
        const response = await AuthService.checkAuth();
        const verifiedUser = response.data?.user;
        if (!response.success || !verifiedUser || verifiedUser.id !== userId || userRef.current?.id !== userId) {
            throw new Error('The account changed. Sign in again to verify purchases.');
        }
        await AuthService.cacheUser(verifiedUser, scope);
        assertSession(scope);
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
        const scope = getSessionScope();

        void restoreSession()
            .then((restoredUser) => {
                if (active && scope === getSessionScope()) setUser(restoredUser);
            })
            .catch(() => {
                if (active && scope === getSessionScope()) setUser(null);
            })
            .finally(() => {
                if (active) setReady(true);
            });

        return () => {
            active = false;
        };
    }, [setUser]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const changed = (event: StorageEvent) => {
            if (event.key !== null && event.key !== USER_KEY) return;
            // Cookies are shared between tabs. Stop work under the previous tab's identity.
            const scope = changeSession();
            setSessionId(scope.id);
            setUser(null);
            void restoreSession()
                .then((restored) => {
                    if (scope === getSessionScope()) setUser(restored);
                })
                .catch(() => undefined);
        };
        window.addEventListener('storage', changed);
        return () => window.removeEventListener('storage', changed);
    }, [setUser]);

    async function login(request: AuthRequest): Promise<ActionResult> {
        try {
            await AuthService.waitForLogout();
            const scope = getSessionScope();
            setNotice('');
            const response = await AuthService.login({
                ...request,
                rememberMe: Platform.OS === 'web' ? request.rememberMe : true,
            });
            const authenticatedUser = response.data?.user;

            if (!response.success || !authenticatedUser) return fail(response.message || 'Login Failed');

            assertSession(scope);
            const nextScope = changeSession(authenticatedUser.id);
            try {
                await AuthService.saveLogin(response.data!, nextScope);
            } catch (error) {
                if (nextScope === getSessionScope()) await clearSession();
                throw error;
            }
            assertSession(nextScope);
            setSessionId(nextScope.id);
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
        if (!userRef.current) return ok();
        const userId = userRef.current.id;
        const scope = changeSession();
        setSessionId(scope.id);
        setUser(null);
        setNotice('');
        router.replace('/login');
        void Promise.resolve(AuthService.logout(scope, userId)).catch((error: unknown) => {
            if (scope === getSessionScope()) setNotice(getErrorMessage(error, 'Could not finish logging out.'));
        });
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

    return (
        <SessionContext.Provider
            value={{
                sessionId,
                user,
                ready,
                isAuthenticated: Boolean(user),
                isPremium: user?.tier === 'PREMIUM',
                login,
                register,
                logout,
                deleteAccount,
                refreshPurchases,
                notice,
                dismissNotice: () => setNotice(''),
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
