import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors } from '../colors';
import { ApiError, getErrorMessage } from '../api';
import { useSession } from '../session';
import { AuthService } from '../services/auth.service';
import { assertSession, getSessionScope } from '../services/session-scope';
import type { AppleSignInProps } from './apple-sign-in';

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
    const { fontScale } = useWindowDimensions();
    const [sdk, setSdk] = useState<AppleSdk | null>(null);
    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);
    const focus = useRef<object | null>(null);
    const pending = useRef(false);
    const enabled = process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true';

    useFocusEffect(
        useCallback(() => {
            focus.current = {};
            let mounted = true;
            const scope = getSessionScope();
            if (enabled) {
                void (async () => {
                    // Keep older development builds usable until their native modules are rebuilt.
                    const apple = await import('expo-apple-authentication');
                    if (!(await apple.isAvailableAsync())) return;
                    if (mounted) setSdk(apple);
                    const connection = connect ? await AuthService.appleConnection() : null;
                    assertSession(scope);
                    if (!mounted) return;
                    setConnected(Boolean(connection?.data?.connected));
                })().catch(() => {
                    /* Other sign-in methods remain available. */
                });
            }
            return () => {
                mounted = false;
                focus.current = null;
                setBusy(false);
                onBusyChange(false);
            };
        }, [connect, enabled, onBusyChange]),
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
            const nonce = randomUUID();
            const state = randomUUID();
            const credential = await sdk.signInAsync({
                requestedScopes: [sdk.AppleAuthenticationScope.EMAIL],
                nonce,
                state,
            });
            if (focus.current !== startedFocus) return;
            assertSession(scope);
            if (credential.state !== state || !credential.authorizationCode) throw new Error('Invalid Apple response');
            const request = { authorizationCode: credential.authorizationCode, nonce, rememberMe };
            const result = connect ? await AuthService.connectApple(request) : await session.login(request);
            if (focus.current !== startedFocus) return;
            if (!result.success) {
                onError(result.message || 'Apple sign-in failed. Try again.');
                return;
            }
            if (connect) {
                assertSession(scope);
                setConnected(true);
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

    if (!enabled || !sdk) return null;
    return (
        <View style={connect ? styles.connection : styles.section} testID='apple-sign-in-section'>
            {connect && <Text style={styles.label}>{connected ? 'Apple connected' : 'Connect Apple'}</Text>}
            {(!connect || !connected) && (
                <View style={{ height: Math.max(48, 48 * fontScale) }}>
                    {busy ? (
                        <View
                            style={styles.loading}
                            accessibilityLabel='Signing in with Apple'
                            accessibilityRole='progressbar'
                        >
                            <ActivityIndicator color='#000000' testID='apple-sign-in-loading' />
                        </View>
                    ) : (
                        <View style={disabled && styles.disabled} pointerEvents={disabled ? 'none' : 'auto'}>
                            <sdk.AppleAuthenticationButton
                                buttonType={sdk.AppleAuthenticationButtonType.CONTINUE}
                                buttonStyle={sdk.AppleAuthenticationButtonStyle.WHITE}
                                cornerRadius={28}
                                style={{ width: '100%', height: Math.max(48, 48 * fontScale) }}
                                accessibilityState={{ disabled }}
                                onPress={() => void signIn()}
                                testID='apple-sign-in'
                            />
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    section: { marginTop: 12 },
    connection: { padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
    label: { color: colors.text, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.55 },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 28 },
});
