import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../colors';

export default function UpgradeScreen() {
    const router = useRouter();

    return (
        <>
            <Head>
                <title>Tally | Upgrade</title>
            </Head>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content} testID='upgrade-placeholder-page'>
                    <Text accessibilityRole='header' aria-level={1} style={styles.title}>
                        Upgrade is coming later
                    </Text>
                    <Text style={styles.copy}>
                        This page is informational only. Upgrade and billing functionality are not implemented yet.
                    </Text>
                    <Text style={styles.copy}>
                        You cannot purchase or unlock premium access from this screen in this run.
                    </Text>
                    <Pressable
                        accessibilityRole='button'
                        onPress={() => router.replace('/home')}
                        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                        testID='upgrade-placeholder-back'
                    >
                        <Text style={styles.buttonText}>Back to home</Text>
                    </Pressable>
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
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
        gap: 16,
        padding: 24,
    },
    title: {
        color: colors.text,
        fontSize: 30,
        fontWeight: '800',
    },
    copy: {
        color: colors.muted,
        fontSize: 16,
        lineHeight: 24,
    },
    button: {
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        backgroundColor: colors.primary,
        borderRadius: 10,
    },
    buttonPressed: {
        backgroundColor: colors.primaryPressed,
    },
    buttonText: {
        color: colors.onPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
});
