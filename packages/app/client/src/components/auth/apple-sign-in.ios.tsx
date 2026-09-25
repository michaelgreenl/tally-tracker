import { useCallback, useRef, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ApiError, getErrorMessage } from '../../infra/http/api';
import { useSession } from '../../contexts/session-context';
import { AuthService } from '../../services/auth/auth.service';
import { assertSession, getSessionScope } from '../../services/session/session-scope';
import { authorizeApple } from '../../services/auth/native-authorization';
import type { AppleSignInProps } from './apple-sign-in';
import { SocialSignInButton } from './social-sign-in-button';

export function AppleSignIn({
    connect = false,
    disabled,
    rememberMe,
    onBusyChange,
    onError,
    onSuccess,
}: AppleSignInProps) {
    const session = useSession();
    const [busy, setBusy] = useState(false);
    const focus = useRef<object | null>(null);
    const pending = useRef(false);
    const enabled = process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true';

    useFocusEffect(
        useCallback(() => {
            focus.current = {};
            return () => {
                focus.current = null;
                setBusy(false);
                onBusyChange(false);
            };
        }, [onBusyChange]),
    );

    async function signIn() {
        if (!enabled || disabled || pending.current || !focus.current) return;
        const startedFocus = focus.current;
        const scope = getSessionScope();
        pending.current = true;
        setBusy(true);
        onBusyChange(true);
        onError('');
        try {
            const credential = await authorizeApple(AppleAuthentication);
            if (focus.current !== startedFocus) return;
            assertSession(scope);
            const request = { ...credential, rememberMe };
            const result = connect ? await AuthService.connectApple(request) : await session.login(request);
            if (focus.current !== startedFocus) return;
            if (!result.success) {
                onError(result.message || 'Apple sign-in failed. Try again.');
                return;
            }
            if (connect) {
                assertSession(scope);
                await session.refreshUser();
                if (focus.current !== startedFocus) return;
                assertSession(scope);
            }
            onSuccess();
        } catch (error) {
            if (
                focus.current === startedFocus &&
                scope === getSessionScope() &&
                !(error && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED')
            ) {
                onError(error instanceof ApiError ? getErrorMessage(error) : 'Apple sign-in failed. Try again.');
            }
        } finally {
            pending.current = false;
            if (focus.current === startedFocus) {
                setBusy(false);
                onBusyChange(false);
            }
        }
    }

    if (!enabled) return null;
    return (
        <View style={!connect && styles.section} testID='apple-sign-in-section'>
            <SocialSignInButton provider='Apple' disabled={disabled} busy={busy} onPress={() => void signIn()} />
        </View>
    );
}

const styles = StyleSheet.create({
    section: { marginTop: 12 },
});
