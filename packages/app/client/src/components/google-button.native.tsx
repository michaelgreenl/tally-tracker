import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors } from '../colors';
import type { GoogleButtonProps } from './google-sign-in';

type GoogleSdk = typeof import('react-native-nitro-google-signin');

export function GoogleButton({ disabled, onCredential, onError, onBusyChange }: GoogleButtonProps) {
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
        return unavailable ? <Text style={styles.error}>Update the app to use Google sign-in.</Text> : null;
    }
    return (
        <sdk.GoogleSignInButton
            accessibilityLabel='Continue with Google'
            accessibilityRole='button'
            accessibilityState={{ disabled, busy: disabled }}
            colorScheme='dark'
            size='wide'
            signInBehavior='none'
            onPress={signIn}
            disabled={disabled}
            loading={disabled}
            style={styles.button}
            testID='google-sign-in'
        />
    );
}

const styles = StyleSheet.create({
    button: { width: '100%', height: 48 },
    error: { color: colors.muted, textAlign: 'center', fontSize: 14 },
});
