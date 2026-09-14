import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../colors';
import { useCounters } from '../counters';
import { useSession } from '../session';

export default function JoinScreen() {
    const router = useRouter();
    const counters = useCounters();
    const session = useSession();
    const params = useLocalSearchParams<{ code?: string | string[] }>();
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current || counters.loading) return;
        handled.current = true;
        const code = Array.isArray(params.code) ? params.code[0] : params.code;

        void (async () => {
            if (!code) {
                Alert.alert('Invalid link');
                router.replace('/home');
                return;
            }
            if (!session.isAuthenticated) {
                Alert.alert('Sign in to join shared counters');
                router.replace({ pathname: '/login', params: { inviteCode: code } });
                return;
            }

            const result = await counters.joinCounter(code);
            Alert.alert(result.success ? 'Counter accepted!' : `Failed to join: ${result.message}`);
            router.replace('/home');
        })();
    }, [counters, params.code, router, session.isAuthenticated]);

    return (
        <>
            <Head>
                <title>Tally | Join</title>
            </Head>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    <ActivityIndicator color={colors.link} size='large' />
                    <Text accessibilityRole='header' aria-level={1} style={styles.title}>
                        Joining counter…
                    </Text>
                </View>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 24,
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '700',
    },
});
