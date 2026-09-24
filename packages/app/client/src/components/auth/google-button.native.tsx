import { useEffect, useRef, useState } from 'react';
import { useFonts } from 'expo-font';
import { StyleSheet } from 'react-native';

import { colors } from '../../theme/colors';
import type { GoogleButtonProps } from './google-button';
import { MessageText } from '../shared/message-text';
import { authorizeGoogle } from '../../services/auth/native-authorization';
import { SocialSignInButton } from './social-sign-in-button';

type GoogleSdk = typeof import('react-native-nitro-google-signin');

export function GoogleButton({ disabled, busy, onCredential, onError, onBusyChange }: GoogleButtonProps) {
    const [fontsLoaded] = useFonts({ GoogleSansMedium: require('../../../assets/fonts/GoogleSans-Medium.ttf') });
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
            const idToken = await authorizeGoogle(sdk);
            if (idToken) await onCredential(idToken);
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
