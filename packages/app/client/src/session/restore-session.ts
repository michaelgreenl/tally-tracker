import { UNAUTHORIZED } from '@tally/core/client';
import { Platform } from 'react-native';

import { ApiError } from '../api';
import { AuthService } from './auth.service';
import { assertSession, getSessionScope, SessionChangedError } from './session-scope';

import type { ClientUser } from '@tally/core/client';

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
            scope.userId = null;
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
