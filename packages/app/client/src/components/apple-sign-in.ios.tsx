import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../colors';
import { ApiError, getErrorMessage } from '../api';
import { useSession } from '../session';
import { AuthService } from '../services/auth.service';
import { assertSession, getSessionScope } from '../services/session-scope';
import type { AppleSignInProps } from './apple-sign-in';
import { SocialSignInButton } from './social-sign-in-button';
import { Dialog } from './dialog';

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
    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);
    const [methodsOpen, setMethodsOpen] = useState(false);
    const [connectionError, setConnectionError] = useState('');
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

    function reportError(message: string) {
        if (connect) setConnectionError(message);
        else onError(message);
    }

    async function signIn() {
        if (!sdk || disabled || pending.current || !focus.current) return;
        const startedFocus = focus.current;
        const scope = getSessionScope();
        pending.current = true;
        setBusy(true);
        onBusyChange(true);
        reportError('');
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
                reportError(result.message || 'Apple sign-in failed. Try again.');
                return;
            }
            if (connect) {
                assertSession(scope);
                setConnected(true);
                await session.refreshUser();
                if (focus.current !== startedFocus) return;
                assertSession(scope);
                setMethodsOpen(false);
            }
            onSuccess();
        } catch (error) {
            if (
                focus.current === startedFocus &&
                scope === getSessionScope() &&
                !(error && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED')
            ) {
                reportError(error instanceof ApiError ? getErrorMessage(error) : 'Apple sign-in failed. Try again.');
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
    if (connect) {
        return (
            <>
                <Pressable
                    accessibilityRole='button'
                    accessibilityState={{ disabled, expanded: methodsOpen }}
                    disabled={disabled}
                    onPress={() => {
                        setConnectionError('');
                        setMethodsOpen(true);
                    }}
                    style={({ pressed }) => [styles.connection, pressed && styles.pressed]}
                    testID='settings-sign-in-methods'
                >
                    <Text style={styles.label}>Sign-in methods</Text>
                    <Text accessible={false} aria-hidden style={styles.chevron}>
                        ›
                    </Text>
                </Pressable>
                <Dialog
                    visible={methodsOpen}
                    dismissOnBackdropPress
                    onRequestClose={() => {
                        if (!busy) setMethodsOpen(false);
                    }}
                    title='Sign-in methods'
                    description='Manage Apple sign-in for this account.'
                    testID='sign-in-methods-dialog'
                >
                    {connected ? (
                        <Text style={styles.label} testID='apple-connected'>
                            Apple connected
                        </Text>
                    ) : (
                        <SocialSignInButton
                            provider='Apple'
                            disabled={disabled}
                            busy={busy}
                            onPress={() => void signIn()}
                        />
                    )}
                    {Boolean(connectionError) && (
                        <Text
                            accessibilityRole='alert'
                            accessibilityLiveRegion='polite'
                            style={styles.error}
                            testID='apple-connect-error'
                        >
                            {connectionError}
                        </Text>
                    )}
                    <Pressable
                        accessibilityRole='button'
                        accessibilityState={{ disabled: busy }}
                        disabled={busy}
                        onPress={() => setMethodsOpen(false)}
                        style={({ pressed }) => [styles.done, pressed && styles.dimmed, busy && styles.dimmed]}
                        testID='sign-in-methods-done'
                    >
                        <Text style={styles.doneText}>Done</Text>
                    </Pressable>
                </Dialog>
            </>
        );
    }
    return (
        <View style={styles.section} testID='apple-sign-in-section'>
            <SocialSignInButton provider='Apple' disabled={disabled} busy={busy} onPress={() => void signIn()} />
        </View>
    );
}

const styles = StyleSheet.create({
    section: { marginTop: 12 },
    connection: {
        minHeight: 54,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    label: { color: colors.text, fontSize: 15, fontWeight: '700' },
    chevron: { color: colors.muted, fontSize: 22 },
    pressed: { backgroundColor: colors.input },
    error: { color: colors.danger, fontSize: 14 },
    done: { minHeight: 44, minWidth: 44, alignSelf: 'flex-end', justifyContent: 'center' },
    doneText: { color: colors.link, fontSize: 16, fontWeight: '700' },
    dimmed: { opacity: 0.55 },
});
