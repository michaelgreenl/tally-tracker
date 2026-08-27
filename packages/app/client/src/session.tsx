import { UNAUTHORIZED } from '@tally/core/client';
import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { ApiError, getErrorMessage, setUnauthorizedHandler } from './api';
import { AuthService } from './services/auth.service';

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
    const [user, setUser] = useState<ClientUser | null>(null);
    const [ready, setReady] = useState(false);

    const clearSession = useCallback(async () => {
        setUser(null);
        await AuthService.clearLocalAuth();
    }, []);

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
    }, []);

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
            const updatedUser = { ...user, ...updates };
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
