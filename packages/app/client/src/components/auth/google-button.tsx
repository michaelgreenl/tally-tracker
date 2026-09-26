import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { colors } from '../../theme/colors';
import { MessageText } from '../shared/message-text';

export type GoogleButtonProps = {
    disabled: boolean;
    busy: boolean;
    onCredential: (idToken: string) => Promise<void>;
    onError: (message: string) => void;
    onBusyChange: (busy: boolean) => void;
};

export function GoogleButton({ disabled, busy, onCredential, onError }: GoogleButtonProps) {
    const [failed, setFailed] = useState(false);
    const [width, setWidth] = useState(0);
    return (
        <GoogleOAuthProvider
            clientId={process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!}
            onScriptLoadError={() => setFailed(true)}
        >
            <View
                style={styles.button}
                onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
                testID='google-sign-in'
            >
                {failed ? (
                    <MessageText accessibilityRole='alert' style={styles.error}>
                        Google sign-in is unavailable. Reload to retry.
                    </MessageText>
                ) : (
                    <>
                        {width > 0 && (
                            <div
                                inert={disabled}
                                style={{ display: busy ? 'none' : undefined, opacity: disabled ? 0.55 : 1 }}
                            >
                                <GoogleLogin
                                    theme='filled_black'
                                    shape='pill'
                                    size='large'
                                    text='continue_with'
                                    width={width}
                                    auto_select={false}
                                    onSuccess={({ credential }) => {
                                        if (disabled) return;
                                        if (credential) void onCredential(credential);
                                        else onError('Google sign-in failed. Try again.');
                                    }}
                                    onError={() => onError('Google sign-in failed. Try again.')}
                                />
                            </div>
                        )}
                        {busy && (
                            <ActivityIndicator
                                color={colors.text}
                                accessibilityLabel='Signing in'
                                testID='google-sign-in-loading'
                            />
                        )}
                    </>
                )}
            </View>
        </GoogleOAuthProvider>
    );
}

const styles = StyleSheet.create({
    button: { minHeight: 48, justifyContent: 'center' },
    error: { color: colors.danger, textAlign: 'center', fontSize: 14 },
});
