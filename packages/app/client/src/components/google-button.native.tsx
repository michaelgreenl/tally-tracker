import { useEffect, useRef, useState } from 'react';
import { useFonts } from 'expo-font';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../colors';
import type { GoogleButtonProps } from './google-sign-in';
import { MessageText } from './message-text';

type GoogleSdk = typeof import('react-native-nitro-google-signin');

export function GoogleButton({ disabled, busy, onCredential, onError, onBusyChange }: GoogleButtonProps) {
    const [fontsLoaded] = useFonts({ GoogleSansMedium: require('../../assets/fonts/GoogleSans-Medium.ttf') });
    const [sdk, setSdk] = useState<GoogleSdk | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    const pending = useRef(false);
    useEffect(() => {
        // An older development build must still open before its native modules are rebuilt.
        void import('react-native-nitro-google-signin').then(setSdk).catch(() => setUnavailable(true));
    }, []);

    async function signIn() {
        if (!sdk || disabled || pending.current) return;
        pending.current = true;
        onBusyChange(true);
        try {
            sdk.GoogleOneTapSignIn.configure({
                webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
                iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
                offlineAccess: false,
                autoSelectOnSignIn: false,
            });
            await sdk.GoogleOneTapSignIn.checkPlayServices();
            await sdk.GoogleOneTapSignIn.signOut();
            const response = await sdk.GoogleOneTapSignIn.presentExplicitSignIn();
            if (sdk.isSuccessResponse(response)) await onCredential(response.data.idToken);
            else if (!sdk.isCancelledResponse(response)) onError('Google sign-in failed. Try again.');
        } catch (error) {
            if (!sdk.isErrorWithCode(error) || error.code !== sdk.statusCodes.SIGN_IN_CANCELLED) {
                onError('Google sign-in failed. Try again.');
            }
        } finally {
            pending.current = false;
            onBusyChange(false);
        }
    }

    if (!sdk) {
        return unavailable ? (
            <MessageText style={styles.error}>Update the app to use Google sign-in.</MessageText>
        ) : null;
    }
    return (
        <Pressable
            accessibilityLabel='Continue with Google'
            accessibilityRole='button'
            accessibilityState={{ disabled, busy }}
            onPress={signIn}
            disabled={disabled}
            style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}
            testID='google-sign-in'
        >
            <View style={styles.icon}>
                {busy ? (
                    <ActivityIndicator color='#202124' testID='google-sign-in-loading' />
                ) : (
                    // Google's unmodified logo, as rendered by its web sign-in button.
                    <Svg aria-hidden width={20} height={20} viewBox='0 0 48 48'>
                        <Path
                            fill='#EA4335'
                            d='M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z'
                        />
                        <Path
                            fill='#4285F4'
                            d='M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z'
                        />
                        <Path
                            fill='#FBBC05'
                            d='M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z'
                        />
                        <Path
                            fill='#34A853'
                            d='M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z'
                        />
                    </Svg>
                )}
            </View>
            <Text style={[styles.label, fontsLoaded && styles.labelFont]}>Continue with Google</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    // Google branding colors stay independent of the app palette.
    button: {
        width: '100%',
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 4,
        borderRadius: 28,
        backgroundColor: '#202124',
    },
    icon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        flex: 1,
        marginRight: 16,
        paddingVertical: 8,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    labelFont: { fontFamily: 'GoogleSansMedium' },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.55 },
    error: { color: colors.muted, textAlign: 'center', fontSize: 14 },
});
