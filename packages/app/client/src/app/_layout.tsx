import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CounterProvider } from '../counters';
import { SessionProvider, useSession } from '../session';

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
            <Stack.Screen name='index' options={{ title: 'Tally Tracker' }} />
            <Stack.Screen name='home' options={{ title: 'Tally Tracker' }} />
            <Stack.Screen name='join' options={{ title: 'Tally Tracker | Join' }} />
            <Stack.Screen name='settings' options={{ title: 'Tally Tracker | Settings' }} />
            <Stack.Screen name='upgrade' options={{ title: 'Tally Tracker | Upgrade' }} />
            <Stack.Screen name='legal/[document]' />
            <Stack.Protected guard={!session.isAuthenticated}>
                <Stack.Screen name='login' options={{ title: 'Tally Tracker | Login' }} />
                <Stack.Screen name='register' options={{ title: 'Tally Tracker | Register' }} />
            </Stack.Protected>
        </Stack>
    );
}

export default function RootLayout() {
    return (
        <SessionProvider>
            <CounterProvider>
                <Navigator />
                <StatusBar style='light' />
            </CounterProvider>
        </SessionProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#495057',
    },
});
