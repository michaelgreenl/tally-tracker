import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../colors';
import { ApiError, getErrorMessage } from '../../api';
import { useSession } from '../../session/session-context';
import { AuthService } from '../../session/auth.service';
import { assertSession, getSessionScope } from '../../session/session-scope';
import { authorizeApple } from './native-authorization';
import type { AppleSignInProps } from './apple-sign-in';
import { SocialSignInButton } from './social-sign-in-button';

type AppleSdk = typeof import('expo-apple-authentication');

export function AppleSignIn({
    connect = false,
    disabled,
    rememberMe,
    onBusyChange,
    onError,
    onSuccess,
}: AppleSignInProps) {
    const session = useSession();
    const [sdk, setSdk] = useState<AppleSdk | null>(null);
    const [busy, setBusy] = useState(false);
    const [unavailable, setUnavailable] = useState(false);
    const focus = useRef<object | null>(null);
    const pending = useRef(false);
    const enabled = process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true';

    useFocusEffect(
        useCallback(() => {
            focus.current = {};
            let mounted = true;
            if (enabled) {
                void (async () => {
                    // Keep older development builds usable until their native modules are rebuilt.
                    const apple = await import('expo-apple-authentication');
                    const available = await apple.isAvailableAsync();
                    if (mounted) {
                        setSdk(available ? apple : null);
                        setUnavailable(!available);
                    }
                })().catch(() => {
                    if (mounted) setUnavailable(true);
                });
            }
            return () => {
                mounted = false;
                focus.current = null;
                setBusy(false);
                onBusyChange(false);
            };
        }, [enabled, onBusyChange]),
    );

    async function signIn() {
        if (!sdk || disabled || pending.current || !focus.current) return;
        const startedFocus = focus.current;
        const scope = getSessionScope();
        pending.current = true;
        setBusy(true);
        onBusyChange(true);
        onError('');
        try {
            const credential = await authorizeApple(sdk);
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

    if (connect && unavailable) {
        return <Text style={styles.error}>Apple sign-in is unavailable. Update the app to retry.</Text>;
    }
    if (!enabled || !sdk) return null;
    return (
        <View style={!connect && styles.section} testID='apple-sign-in-section'>
            <SocialSignInButton provider='Apple' disabled={disabled} busy={busy} onPress={() => void signIn()} />
        </View>
    );
}

const styles = StyleSheet.create({
    section: { marginTop: 12 },
    error: { color: colors.danger, fontSize: 14 },
});
