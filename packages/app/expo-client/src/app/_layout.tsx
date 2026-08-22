import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

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
            <Navigator />
            <StatusBar style='light' />
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
