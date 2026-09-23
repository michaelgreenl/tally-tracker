import { useCallback, useRef, useState } from 'react';
import { loginPasswordSchema } from '@tally/core/client';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../colors';
import { getErrorMessage } from '../../api';
import { AuthService } from '../../services/auth.service';
import { useSession } from '../../session';
import { assertSession, getSessionScope } from '../../services/session-scope';
import { Dialog } from '../dialog';
import { FormField, styles as formStyles } from '../auth-form';
import { GoogleButton } from './google-button';
import { MessageText } from '../message-text';

type Props = {
    connect?: boolean;
    disabled: boolean;
    busy: boolean;
    rememberMe?: boolean;
    onBusyChange: (busy: boolean) => void;
    onError: (message: string) => void;
    onSuccess: () => void;
};

export function GoogleSignIn({ connect = false, disabled, busy, rememberMe, onBusyChange, onError, onSuccess }: Props) {
    const session = useSession();
    const [linkToken, setLinkToken] = useState('');
    const [password, setPassword] = useState('');
    const [linkError, setLinkError] = useState('');
    const [focused, setFocused] = useState(false);
    const pending = useRef(false);
    const active = useRef(true);
    const scope = useRef(getSessionScope());
    useFocusEffect(
        useCallback(() => {
            active.current = true;
            setFocused(true);
            scope.current = getSessionScope();
            return () => {
                active.current = false;
                setFocused(false);
                setLinkToken('');
                setPassword('');
                setLinkError('');
            };
        }, []),
    );

    function closeLink() {
        if (pending.current) return;
        setLinkToken('');
        setPassword('');
        setLinkError('');
    }

    async function signIn(idToken: string, existingPassword?: string) {
        if (pending.current || !active.current) return;
        if (existingPassword !== undefined) {
            const result = loginPasswordSchema.safeParse(existingPassword);
            if (!result.success) {
                setLinkError(result.error.issues[0].message);
                return;
            }
        }
        pending.current = true;
        onBusyChange(true);
        onError('');
        setLinkError('');
        try {
            // Ignore a provider callback after another login or logout has changed the account.
            assertSession(scope.current);
            const result = connect
                ? await AuthService.connectGoogle({ idToken })
                : await session.login({ idToken, password: existingPassword, rememberMe });
            if (!active.current) return;
            if (result.success) {
                if (connect) {
                    assertSession(scope.current);
                    await session.refreshUser();
                    if (!active.current) return;
                    assertSession(scope.current);
                }
                setLinkToken('');
                setPassword('');
                onSuccess();
            } else if (!connect && 'code' in result && result.code === 'GOOGLE_LINK_REQUIRED') {
                setLinkToken(idToken);
            } else if (existingPassword !== undefined) {
                setLinkError(result.message || 'Google sign-in failed. Try again.');
            } else onError(result.message || 'Google sign-in failed. Try again.');
        } catch (error) {
            if (active.current && scope.current === getSessionScope()) onError(getErrorMessage(error));
        } finally {
            pending.current = false;
            onBusyChange(false);
        }
    }

    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) return null;
    if (connect) {
        return focused ? (
            <GoogleButton
                disabled={disabled}
                busy={busy}
                onCredential={signIn}
                onError={onError}
                onBusyChange={onBusyChange}
            />
        ) : null;
    }
    return (
        <View style={styles.section}>
            <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.or}>or</Text>
                <View style={styles.line} />
            </View>
            <View style={styles.button}>
                {focused && (
                    <GoogleButton
                        disabled={disabled || Boolean(linkToken)}
                        busy={busy && !linkToken}
                        onCredential={signIn}
                        onError={onError}
                        onBusyChange={onBusyChange}
                    />
                )}
            </View>
            {Boolean(linkToken) && (
                <Dialog
                    visible
                    dismissOnBackdropPress
                    onRequestClose={closeLink}
                    title='Connect Google'
                    description='Enter your Tally password to connect this account.'
                    testID='google-link-dialog'
                >
                    <FormField
                        label='Password'
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize='none'
                        autoComplete='current-password'
                        textContentType='password'
                        editable={!disabled}
                        returnKeyType='done'
                        onSubmitEditing={() => void signIn(linkToken, password)}
                        testID='google-link-password'
                    />
                    {Boolean(linkError) && (
                        <MessageText accessibilityRole='alert' style={formStyles.errorText}>
                            {linkError}
                        </MessageText>
                    )}
                    <Pressable
                        accessibilityRole='button'
                        disabled={disabled || !password}
                        onPress={() => void signIn(linkToken, password)}
                        style={({ pressed }) => [
                            formStyles.primaryButton,
                            (disabled || !password) && formStyles.primaryButtonDisabled,
                            pressed && styles.pressed,
                        ]}
                        testID='google-link-submit'
                    >
                        {busy ? (
                            <ActivityIndicator color={colors.onPrimary} testID='google-link-loading' />
                        ) : (
                            <Text style={formStyles.primaryButtonText}>Connect</Text>
                        )}
                    </Pressable>
                    <Pressable
                        accessibilityRole='button'
                        disabled={disabled}
                        onPress={closeLink}
                        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
                        testID='google-link-cancel'
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                </Dialog>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    pressed: { opacity: 0.7 },
    section: { gap: 16, marginTop: 20 },
    button: { minHeight: 48 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
    or: { color: colors.muted, fontSize: 14 },
    cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    cancelText: { color: colors.link, fontWeight: '600', fontSize: 16 },
});
