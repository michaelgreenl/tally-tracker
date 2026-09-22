import { useEffect, useRef, useState } from 'react';
import { useFonts } from 'expo-font';
import { StyleSheet } from 'react-native';

import { colors } from '../colors';
import type { GoogleButtonProps } from './google-sign-in';
import { MessageText } from './message-text';
import { SocialSignInButton } from './social-sign-in-button';

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
        <SocialSignInButton
            provider='Google'
            onPress={signIn}
            disabled={disabled}
            busy={busy}
            fontFamily={fontsLoaded ? 'GoogleSansMedium' : undefined}
        />
    );
}

const styles = StyleSheet.create({
    error: { color: colors.muted, textAlign: 'center', fontSize: 14 },
});
