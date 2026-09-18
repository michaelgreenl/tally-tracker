import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Appearance, Platform, StyleSheet, View } from 'react-native';

import { colors } from '../colors';
import { CounterProvider } from '../counters';
import { initSentry, withSentry } from '../monitoring/sentry';
import { SessionProvider, useSession } from '../session';
import { Snackbar } from '../components/snackbar';

initSentry();
if (Platform.OS !== 'web') Appearance.setColorScheme('dark');

const navigationTheme = {
    ...DarkTheme,
    colors: {
        primary: colors.link,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.divider,
        notification: colors.danger,
    },
};

function Navigator() {
    const session = useSession();

    if (!session.ready) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator color={colors.link} size='large' />
            </View>
        );
    }

    return (
        <>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name='index' options={{ title: 'Tally' }} />
                <Stack.Screen name='home' options={{ title: 'Tally' }} />
                <Stack.Screen name='join' options={{ title: 'Tally | Join' }} />
                <Stack.Screen name='settings' options={{ title: 'Tally | Settings' }} />
                <Stack.Screen name='upgrade' options={{ title: 'Tally | Upgrade' }} />
                <Stack.Screen name='verify-email' options={{ title: 'Tally | Verify Email' }} />
                <Stack.Screen name='legal/[document]' />
                <Stack.Protected guard={!session.isAuthenticated}>
                    <Stack.Screen name='login' options={{ title: 'Tally | Login' }} />
                    <Stack.Screen name='register' options={{ title: 'Tally | Register' }} />
                    <Stack.Screen name='forgot-password' options={{ title: 'Tally | Reset Password' }} />
                </Stack.Protected>
            </Stack>
            <Snackbar message={session.notice} onDismiss={session.dismissNotice} />
        </>
    );
}

function RootLayout() {
    return (
        <ThemeProvider value={navigationTheme}>
            {Platform.OS === 'web' && (
                <Head>
                    <meta name='color-scheme' content='dark' />
                </Head>
            )}
            <SessionProvider>
                <CounterProvider>
                    <Navigator />
                    <StatusBar style='light' />
                </CounterProvider>
            </SessionProvider>
        </ThemeProvider>
    );
}

export default withSentry(RootLayout);

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
    },
});
