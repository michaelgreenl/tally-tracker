import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { colors } from '../colors';
import type { GoogleButtonProps } from './google-sign-in';

export function GoogleButton({ disabled, onCredential, onError }: GoogleButtonProps) {
    const [failed, setFailed] = useState(false);
    return (
        <GoogleOAuthProvider
            clientId={process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!}
            onScriptLoadError={() => setFailed(true)}
        >
            <View style={styles.button} testID='google-sign-in'>
                {failed ? (
                    <Text accessibilityRole='alert' style={styles.error}>
                        Google sign-in is unavailable. Reload to retry.
                    </Text>
                ) : (
                    <>
                        <View style={disabled && styles.hidden}>
                            <GoogleLogin
                                theme='filled_black'
                                shape='pill'
                                size='large'
                                text='continue_with'
                                auto_select={false}
                                onSuccess={({ credential }) => {
                                    if (disabled) return;
                                    if (credential) void onCredential(credential);
                                    else onError('Google sign-in failed. Try again.');
                                }}
                                onError={() => onError('Google sign-in failed. Try again.')}
                            />
                        </View>
                        {disabled && <ActivityIndicator color={colors.text} accessibilityLabel='Signing in' />}
                    </>
                )}
            </View>
        </GoogleOAuthProvider>
    );
}

const styles = StyleSheet.create({
    hidden: { display: 'none' },
    button: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
    error: { color: colors.danger, textAlign: 'center', fontSize: 14 },
});
