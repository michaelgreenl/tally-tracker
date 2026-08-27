import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const tokenStorage = {
    getAccessToken() {
        return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    },

    setAccessToken(token: string) {
        return SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    },

    getRefreshToken() {
        return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    },

    setRefreshToken(token: string) {
        return SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    },

    async clear() {
        await Promise.all([
            SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
            SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        ]);
    },
};
