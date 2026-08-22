import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../session';

import type { PropsWithChildren } from 'react';

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
    return (
        <View style={styles.section}>
            <Text accessibilityRole='header' aria-level={2} style={styles.sectionTitle}>
                {title}
            </Text>
            <View style={styles.card}>{children}</View>
        </View>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
        </View>
    );
}

export default function SettingsScreen() {
    const router = useRouter();
    const session = useSession();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    async function deleteAccount() {
        setDeleteLoading(true);
        setDeleteError('');
        const result = await session.deleteAccount();

        if (!result.success) {
            setDeleteError(result.message);
            setDeleteLoading(false);
            return;
        }

        setDeleteOpen(false);
        setDeleteLoading(false);
    }

    return (
        <>
            <Head>
                <title>Tally Tracker | Settings</title>
            </Head>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Pressable
                        accessibilityRole='button'
                        onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
                        style={styles.backButton}
                    >
                        <Text style={styles.headerActionText}>Back</Text>
                    </Pressable>
                    <Text accessibilityRole='header' aria-level={1} style={styles.headerTitle}>
                        Settings
                    </Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.content}>
                        <Section title='Account'>
                            {session.isAuthenticated ? (
                                <>
                                    <Row label='Email' value={session.user?.email || 'Unknown account'} />
                                    <Row label='Tier' value={session.isPremium ? 'Premium' : 'Basic'} />
                                    <Pressable
                                        accessibilityRole='button'
                                        onPress={() => void session.logout()}
                                        style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
                                        testID='settings-logout'
                                    >
                                        <Text style={styles.actionText}>Logout</Text>
                                    </Pressable>
                                </>
                            ) : (
                                <>
                                    <View style={styles.guestRow}>
                                        <Text style={styles.guestTitle}>Guest mode</Text>
                                        <Text style={styles.guestCopy}>
                                            Sign in to sync counters, view account status, and manage account options.
                                        </Text>
                                    </View>
                                    <View style={styles.accountActions}>
                                        <Link href='/login' asChild>
                                            <Pressable accessibilityRole='link' style={styles.primaryButton}>
                                                <Text style={styles.primaryButtonText}>Log in</Text>
                                            </Pressable>
                                        </Link>
                                        <Link href='/register' asChild>
                                            <Pressable accessibilityRole='link' style={styles.secondaryButton}>
                                                <Text style={styles.secondaryButtonText}>Sign up</Text>
                                            </Pressable>
                                        </Link>
                                    </View>
                                </>
                            )}
                        </Section>

                        <Section title='Subscription'>
                            <View style={styles.detailRow}>
                                <View style={styles.detailCopy}>
                                    <Text style={styles.rowLabel}>Manage subscription</Text>
                                    <Text style={styles.guestCopy}>
                                        {session.isAuthenticated
                                            ? session.isPremium
                                                ? 'Premium access is active'
                                                : 'No paid subscription'
                                            : 'Sign in to view subscription status'}
                                    </Text>
                                </View>
                                <Text style={styles.rowValue}>
                                    {session.isAuthenticated ? 'Coming later' : 'Unavailable'}
                                </Text>
                            </View>
                        </Section>

                        <Section title='Legal'>
                            <Link href='/legal/privacy' asChild>
                                <Pressable accessibilityRole='link' style={styles.actionRow}>
                                    <Text style={styles.actionText}>Privacy Policy</Text>
                                </Pressable>
                            </Link>
                            <Link href='/legal/terms' asChild>
                                <Pressable accessibilityRole='link' style={styles.actionRow}>
                                    <Text style={styles.actionText}>Terms of Service</Text>
                                </Pressable>
                            </Link>
                            <Link href='/legal/support' asChild>
                                <Pressable accessibilityRole='link' style={styles.actionRow}>
                                    <Text style={styles.actionText}>Support/contact</Text>
                                </Pressable>
                            </Link>
                        </Section>

                        {session.isAuthenticated && (
                            <Section title='Danger zone'>
                                <Pressable
                                    accessibilityRole='button'
                                    onPress={() => {
                                        setDeleteError('');
                                        setDeleteOpen(true);
                                    }}
                                    style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
                                    testID='settings-delete-account'
                                >
                                    <Text style={styles.deleteText}>Delete account</Text>
                                </Pressable>
                            </Section>
                        )}
                    </View>
                </ScrollView>

                <Modal
                    animationType='fade'
                    onRequestClose={() => {
                        if (!deleteLoading) setDeleteOpen(false);
                    }}
                    transparent
                    visible={deleteOpen}
                >
                    <View accessibilityViewIsModal style={styles.modalOverlay} testID='delete-account-confirm'>
                        <View style={styles.modalCard}>
                            <Text accessibilityRole='header' aria-level={2} style={styles.modalTitle}>
                                Delete account?
                            </Text>
                            <Text style={styles.modalCopy}>
                                This permanently deletes your account and server-side account data. This action cannot
                                be undone.
                            </Text>
                            {Boolean(deleteError) && (
                                <Text
                                    accessibilityLiveRegion='polite'
                                    accessibilityRole='alert'
                                    style={styles.deleteError}
                                >
                                    {deleteError}
                                </Text>
                            )}
                            <View style={styles.modalActions}>
                                <Pressable
                                    accessibilityRole='button'
                                    disabled={deleteLoading}
                                    onPress={() => setDeleteOpen(false)}
                                    style={styles.secondaryButton}
                                >
                                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    accessibilityRole='button'
                                    disabled={deleteLoading}
                                    onPress={() => void deleteAccount()}
                                    style={[styles.deleteButton, deleteLoading && styles.disabled]}
                                >
                                    <Text style={styles.deleteButtonText}>
                                        {deleteLoading ? 'Deleting…' : 'Delete account'}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f1f3f5',
    },
    header: {
        minHeight: 62,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        backgroundColor: '#0f7899',
    },
    backButton: {
        width: 64,
        minHeight: 44,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    headerSpacer: {
        width: 64,
    },
    headerActionText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '800',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 42,
    },
    content: {
        width: '100%',
        maxWidth: 680,
        alignSelf: 'center',
        gap: 22,
    },
    section: {
        gap: 8,
    },
    sectionTitle: {
        color: '#343a40',
        fontSize: 15,
        fontWeight: '800',
    },
    card: {
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#dee2e6',
        borderRadius: 12,
    },
    row: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    rowLabel: {
        color: '#212529',
        fontSize: 15,
        fontWeight: '700',
    },
    rowValue: {
        flexShrink: 1,
        color: '#575e64',
        fontSize: 14,
        textAlign: 'right',
    },
    actionRow: {
        minHeight: 54,
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    rowPressed: {
        backgroundColor: '#f1f3f5',
    },
    actionText: {
        color: '#167ca3',
        fontSize: 15,
        fontWeight: '700',
    },
    guestRow: {
        gap: 5,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    guestTitle: {
        color: '#212529',
        fontSize: 16,
        fontWeight: '700',
    },
    guestCopy: {
        color: '#575e64',
        fontSize: 14,
        lineHeight: 20,
    },
    accountActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        padding: 16,
    },
    primaryButton: {
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        backgroundColor: '#0f7899',
        borderRadius: 9,
    },
    primaryButtonText: {
        color: '#ffffff',
        fontWeight: '700',
    },
    secondaryButton: {
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: '#6c757d',
        borderRadius: 9,
    },
    secondaryButtonText: {
        color: '#343a40',
        fontWeight: '700',
    },
    detailRow: {
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: 16,
    },
    detailCopy: {
        flex: 1,
        gap: 4,
    },
    deleteText: {
        color: '#b42318',
        fontSize: 15,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    modalCard: {
        width: '100%',
        maxWidth: 460,
        gap: 16,
        padding: 24,
        backgroundColor: '#ffffff',
        borderRadius: 16,
    },
    modalTitle: {
        color: '#212529',
        fontSize: 22,
        fontWeight: '800',
    },
    modalCopy: {
        color: '#343a40',
        fontSize: 16,
        lineHeight: 24,
    },
    deleteError: {
        color: '#b42318',
        fontSize: 14,
    },
    modalActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 12,
    },
    deleteButton: {
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        backgroundColor: '#b42318',
        borderRadius: 9,
    },
    deleteButtonText: {
        color: '#ffffff',
        fontWeight: '700',
    },
    disabled: {
        opacity: 0.65,
    },
});
