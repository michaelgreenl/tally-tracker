import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CounterProvider } from '../counters';
import { initSentry, withSentry } from '../monitoring/sentry';
import { SessionProvider, useSession } from '../session';

initSentry();

function Navigator() {
    const session = useSession();

    if (!session.ready) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator color='#23a6d5' size='large' />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name='index' options={{ title: 'Tally' }} />
            <Stack.Screen name='home' options={{ title: 'Tally' }} />
            <Stack.Screen name='join' options={{ title: 'Tally | Join' }} />
            <Stack.Screen name='settings' options={{ title: 'Tally | Settings' }} />
            <Stack.Screen name='upgrade' options={{ title: 'Tally | Upgrade' }} />
            <Stack.Screen name='legal/[document]' />
            <Stack.Protected guard={!session.isAuthenticated}>
                <Stack.Screen name='login' options={{ title: 'Tally | Login' }} />
                <Stack.Screen name='register' options={{ title: 'Tally | Register' }} />
                <Stack.Screen name='verify-email' options={{ title: 'Tally | Verify Email' }} />
                <Stack.Screen name='forgot-password' options={{ title: 'Tally | Reset Password' }} />
            </Stack.Protected>
        </Stack>
    );
}

function RootLayout() {
    return (
        <SessionProvider>
            <CounterProvider>
                <Navigator />
                <StatusBar style='light' />
            </CounterProvider>
        </SessionProvider>
    );
}

export default withSentry(RootLayout);

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#495057',
    },
});
