import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../session';

export default function HomeScreen() {
    const session = useSession();

    return (
        <>
            <Head>
                <title>Tally Tracker</title>
            </Head>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text accessibilityRole='header' aria-level={1} style={styles.headerTitle}>
                        Tally Counter
                    </Text>
                    {session.isAuthenticated ? (
                        <Pressable
                            accessibilityRole='button'
                            onPress={() => void session.logout()}
                            style={styles.action}
                        >
                            <Text style={styles.actionText}>Logout</Text>
                        </Pressable>
                    ) : (
                        <Link href='/login' asChild>
                            <Pressable accessibilityRole='link' style={styles.action}>
                                <Text style={styles.actionText}>Login</Text>
                            </Pressable>
                        </Link>
                    )}
                </View>
                <View style={styles.content}>
                    <Text style={styles.welcome}>Welcome {session.user?.email || 'Guest'}!</Text>
                    <Text style={styles.empty}>Tally Tracker</Text>
                </View>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#495057',
    },
    header: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        backgroundColor: '#0f7899',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
    },
    action: {
        minWidth: 56,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    welcome: {
        marginBottom: 10,
        color: '#e9ecef',
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
    },
    empty: {
        color: '#ced4da',
        fontSize: 16,
    },
});
