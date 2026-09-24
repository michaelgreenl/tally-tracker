import { randomUUID } from 'expo-crypto';

// These functions only obtain provider credentials. Callers own the account and focus lifecycle.
export async function authorizeApple(sdk: typeof import('expo-apple-authentication')) {
    const nonce = randomUUID();
    const state = randomUUID();
    const credential = await sdk.signInAsync({
        requestedScopes: [sdk.AppleAuthenticationScope.EMAIL],
        nonce,
        state,
    });
    if (credential.state !== state || !credential.authorizationCode) throw new Error('Invalid Apple response');
    return { authorizationCode: credential.authorizationCode, nonce };
}

export async function authorizeGoogle(sdk: typeof import('react-native-nitro-google-signin')) {
    sdk.GoogleOneTapSignIn.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        offlineAccess: false,
        autoSelectOnSignIn: false,
    });
    await sdk.GoogleOneTapSignIn.checkPlayServices();
    await sdk.GoogleOneTapSignIn.signOut();
    const response = await sdk.GoogleOneTapSignIn.presentExplicitSignIn();
    if (sdk.isSuccessResponse(response)) return response.data.idToken;
    if (sdk.isCancelledResponse(response)) return null;
    throw new Error('Google sign-in failed. Try again.');
}
