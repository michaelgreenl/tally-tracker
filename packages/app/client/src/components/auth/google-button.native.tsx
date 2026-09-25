import { useRef } from 'react';
import { isLoaded } from 'expo-font';
import * as GoogleSignIn from 'react-native-nitro-google-signin';

import type { GoogleButtonProps } from './google-button';
import { authorizeGoogle } from '../../services/auth/native-authorization';
import { SocialSignInButton } from './social-sign-in-button';

export function GoogleButton({ disabled, busy, onCredential, onError, onBusyChange }: GoogleButtonProps) {
    const pending = useRef(false);

    async function signIn() {
        if (disabled || pending.current) return;
        pending.current = true;
        onBusyChange(true);
        try {
            const idToken = await authorizeGoogle(GoogleSignIn);
            if (idToken) await onCredential(idToken);
        } catch (error) {
            if (!GoogleSignIn.isErrorWithCode(error) || error.code !== GoogleSignIn.statusCodes.SIGN_IN_CANCELLED) {
                onError('Google sign-in failed. Try again.');
            }
        } finally {
            pending.current = false;
            onBusyChange(false);
        }
    }

    return (
        <SocialSignInButton
            provider='Google'
            onPress={signIn}
            disabled={disabled}
            busy={busy}
            fontFamily={isLoaded('GoogleSansMedium') ? 'GoogleSansMedium' : undefined}
        />
    );
}
