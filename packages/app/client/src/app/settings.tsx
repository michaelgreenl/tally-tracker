import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../colors';
import { BackButton } from '../components/back-button';
import { Dialog } from '../components/dialog';
import { SignInMethods } from '../components/settings/sign-in-methods';
import { SettingsAction } from '../components/settings/settings-action';
import { useSession } from '../session/session-context';

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
    const [logoutOpen, setLogoutOpen] = useState(false);
    const [methodsBusy, setMethodsBusy] = useState(false);

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
                <title>Tally | Settings</title>
            </Head>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <BackButton
                        onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
                        testID='settings-back'
                    />
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
                                    <SignInMethods
                                        key={session.sessionId}
                                        disabled={methodsBusy || deleteLoading || logoutOpen || deleteOpen}
                                        onBusyChange={setMethodsBusy}
                                    />
                                    <SettingsAction
                                        label='Logout'
                                        disabled={methodsBusy}
                                        onPress={() => setLogoutOpen(true)}
                                        testID='settings-logout'
                                    />
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
                            <Link href='/upgrade' asChild>
                                <Pressable accessibilityRole='link' testID='settings-subscription'>
                                    {({ pressed }) => (
                                        <View
                                            style={[
                                                styles.detailRow,
                                                !session.isAuthenticated && styles.lastRow,
                                                pressed && styles.rowPressed,
                                            ]}
                                        >
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
                                        </View>
                                    )}
                                </Pressable>
                            </Link>
                            {session.isAuthenticated && (
                                <SettingsAction
                                    label='Delete account'
                                    tone='danger'
                                    last
                                    disabled={methodsBusy}
                                    onPress={() => {
                                        setDeleteError('');
                                        setDeleteOpen(true);
                                    }}
                                    testID='settings-delete-account'
                                />
                            )}
                        </Section>

                        <Section title='Legal'>
                            <Link href='/legal/privacy' asChild>
                                <SettingsAction accessibilityRole='link' label='Privacy Policy' />
                            </Link>
                            <Link href='/legal/terms' asChild>
                                <SettingsAction accessibilityRole='link' label='Terms of Service' />
                            </Link>
                            <Link href='/legal/support' asChild>
                                <SettingsAction accessibilityRole='link' label='Support/Contact' last />
                            </Link>
                        </Section>
                    </View>
                </ScrollView>

                <Dialog
                    visible={logoutOpen}
                    onRequestClose={() => setLogoutOpen(false)}
                    testID='logout-confirm'
                    title='Log out?'
                    description='This logs you out on all devices. Unsynced changes stay on this device for your next login.'
                >
                    <View style={styles.modalActions}>
                        <Pressable
                            accessibilityRole='button'
                            onPress={() => setLogoutOpen(false)}
                            style={styles.secondaryButton}
                            testID='logout-cancel'
                        >
                            <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole='button'
                            onPress={() => {
                                setLogoutOpen(false);
                                void session.logout();
                            }}
                            style={styles.primaryButton}
                            testID='logout-confirm-submit'
                        >
                            <Text style={styles.primaryButtonText}>Log out</Text>
                        </Pressable>
                    </View>
                </Dialog>

                <Dialog
                    onRequestClose={() => {
                        if (!deleteLoading) setDeleteOpen(false);
                    }}
                    visible={deleteOpen}
                    testID='delete-account-confirm'
                    title='Delete account?'
                    description='This permanently deletes your account and server-side account data. This action cannot be undone. Deleting your account does not cancel store subscriptions.'
                >
                    {Boolean(deleteError) && (
                        <Text accessibilityLiveRegion='polite' accessibilityRole='alert' style={styles.deleteError}>
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
                            testID='delete-account-confirm-submit'
                        >
                            <Text style={styles.deleteButtonText}>
                                {deleteLoading ? 'Deleting…' : 'Delete account'}
                            </Text>
                        </Pressable>
                    </View>
                </Dialog>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        minHeight: 62,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 20,
        paddingRight: 12,
        backgroundColor: colors.background,
    },
    headerSpacer: {
        width: 18,
    },
    headerTitle: {
        color: colors.onPrimary,
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
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
    },
    card: {
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.divider,
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
        borderBottomColor: colors.divider,
    },
    rowLabel: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    rowValue: {
        flexShrink: 1,
        color: colors.muted,
        fontSize: 14,
        textAlign: 'right',
    },
    rowPressed: {
        backgroundColor: colors.input,
    },
    lastRow: {
        borderBottomWidth: 0,
    },
    guestRow: {
        gap: 5,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    guestTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
    },
    guestCopy: {
        color: colors.muted,
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
        backgroundColor: colors.primary,
        borderRadius: 9,
    },
    primaryButtonText: {
        color: colors.onPrimary,
        fontWeight: '700',
    },
    secondaryButton: {
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 9,
    },
    secondaryButtonText: {
        color: colors.text,
        fontWeight: '700',
    },
    detailRow: {
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    detailCopy: {
        flex: 1,
        gap: 4,
    },
    deleteError: {
        color: colors.danger,
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
        backgroundColor: colors.dangerButton,
        borderRadius: 9,
    },
    deleteButtonText: {
        color: colors.onPrimary,
        fontWeight: '700',
    },
    disabled: {
        opacity: 0.65,
    },
});
