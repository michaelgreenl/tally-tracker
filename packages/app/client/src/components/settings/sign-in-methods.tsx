import type { SignInMethods as Connections } from '@tally/core/client';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '../../infra/http/api';
import { colors } from '../../theme/colors';
import { AuthService } from '../../services/auth/auth.service';
import { getSessionScope } from '../../services/session/session-scope';
import { AppleSignIn } from '../auth/apple-sign-in';
import { GoogleSignIn } from '../auth/google-sign-in';
import { Dialog } from '../shared/dialog';
import { MessageText } from '../shared/message-text';
import { SettingsAction } from './settings-action';

type Props = { disabled: boolean; onBusyChange: (busy: boolean) => void };

export function SignInMethods({ disabled, onBusyChange }: Props) {
    const [open, setOpen] = useState(false);
    useFocusEffect(useCallback(() => () => setOpen(false), []));
    return (
        <>
            <SettingsAction
                label='Sign-in methods'
                tone='text'
                accessibilityState={{ disabled, expanded: open }}
                disabled={disabled}
                onPress={() => setOpen(true)}
                testID='settings-sign-in-methods'
            >
                <Text accessible={false} aria-hidden style={styles.chevron}>
                    ›
                </Text>
            </SettingsAction>
            {open && <MethodsDialog onClose={() => setOpen(false)} onBusyChange={onBusyChange} />}
        </>
    );
}

function MethodsDialog({ onClose, onBusyChange }: { onClose: () => void; onBusyChange: Props['onBusyChange'] }) {
    const [methods, setMethods] = useState<Connections | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyProvider, setBusyProvider] = useState<'google' | 'apple' | null>(null);
    const active = useRef(true);
    const scope = useRef(getSessionScope());
    const current = () => active.current && scope.current === getSessionScope();

    const load = useCallback(
        () =>
            AuthService.signInMethods()
                .then((result) => {
                    if (!result.success || !result.data) throw new Error('Could not load sign-in methods.');
                    if (active.current && scope.current === getSessionScope()) setMethods(result.data);
                })
                .catch((error) => {
                    if (active.current && scope.current === getSessionScope()) setError(getErrorMessage(error));
                })
                .finally(() => {
                    if (active.current) setLoading(false);
                }),
        [],
    );

    useEffect(() => {
        active.current = true;
        void load();
        return () => {
            active.current = false;
            onBusyChange(false);
        };
    }, [load, onBusyChange]);

    const googleBusy = useCallback(
        (busy: boolean) => {
            if (!active.current) return;
            setBusyProvider(busy ? 'google' : null);
            onBusyChange(busy);
        },
        [onBusyChange],
    );
    const appleBusy = useCallback(
        (busy: boolean) => {
            if (!active.current) return;
            setBusyProvider(busy ? 'apple' : null);
            onBusyChange(busy);
        },
        [onBusyChange],
    );
    const reportError = (message: string) => {
        if (current()) setError(message);
    };
    const connected = (provider: keyof Connections) => {
        if (current()) setMethods((previous) => previous && { ...previous, [provider]: true });
    };
    const close = () => {
        if (!busyProvider) onClose();
    };

    return (
        <Dialog
            visible
            dismissOnBackdropPress
            onRequestClose={close}
            title='Sign-in methods'
            description='Connect another way to sign in.'
            testID='sign-in-methods-dialog'
        >
            {loading ? (
                <ActivityIndicator
                    color={colors.text}
                    accessibilityLabel='Loading sign-in methods'
                    testID='sign-in-methods-loading'
                />
            ) : (
                methods && (
                    <View style={styles.methods}>
                        {methods.google ? (
                            <Connected provider='Google' />
                        ) : process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ? (
                            <GoogleSignIn
                                connect
                                disabled={Boolean(busyProvider)}
                                busy={busyProvider === 'google'}
                                onBusyChange={googleBusy}
                                onError={reportError}
                                onSuccess={() => connected('google')}
                            />
                        ) : (
                            <Text style={styles.unavailable}>Google sign-in is unavailable.</Text>
                        )}
                        {methods.apple ? (
                            <Connected provider='Apple' />
                        ) : Platform.OS === 'ios' && process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true' ? (
                            <AppleSignIn
                                connect
                                disabled={Boolean(busyProvider)}
                                onBusyChange={appleBusy}
                                onError={reportError}
                                onSuccess={() => connected('apple')}
                            />
                        ) : (
                            <Text style={styles.unavailable}>Connect Apple in the iOS app.</Text>
                        )}
                    </View>
                )
            )}
            {Boolean(error) && (
                <MessageText accessibilityRole='alert' style={styles.error} testID='sign-in-methods-error'>
                    {error}
                </MessageText>
            )}
            {!loading && !methods && (
                <Pressable
                    accessibilityRole='button'
                    onPress={() => {
                        setLoading(true);
                        setError('');
                        void load();
                    }}
                    style={styles.action}
                    testID='sign-in-methods-retry'
                >
                    <Text style={styles.actionText}>Retry</Text>
                </Pressable>
            )}
            <Pressable
                accessibilityRole='button'
                disabled={Boolean(busyProvider)}
                onPress={close}
                style={({ pressed }) => [
                    styles.action,
                    styles.done,
                    (pressed || Boolean(busyProvider)) && styles.dimmed,
                ]}
                testID='sign-in-methods-done'
            >
                <Text style={styles.actionText}>Done</Text>
            </Pressable>
        </Dialog>
    );
}

function Connected({ provider }: { provider: 'Google' | 'Apple' }) {
    return (
        <View
            accessible
            accessibilityLabel={`${provider} connected`}
            accessibilityLiveRegion='polite'
            style={styles.connected}
            testID={`${provider.toLowerCase()}-connected`}
        >
            <Text style={styles.label}>{provider}</Text>
            <Text style={styles.unavailable}>Connected</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    label: { color: colors.text, fontSize: 15, fontWeight: '700' },
    chevron: { color: colors.muted, fontSize: 22 },
    methods: { gap: 12 },
    connected: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    unavailable: { color: colors.muted, fontSize: 15, flexShrink: 1 },
    error: { color: colors.danger, fontSize: 14 },
    action: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
    done: { alignSelf: 'flex-end' },
    actionText: { color: colors.link, fontSize: 16, fontWeight: '700' },
    dimmed: { opacity: 0.55 },
});
