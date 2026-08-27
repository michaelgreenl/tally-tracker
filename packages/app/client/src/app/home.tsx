import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useNetworkState } from 'expo-network';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CounterCard } from '../components/counter-card';
import { CounterForm } from '../components/counter-form';
import { GUEST_COUNTER_CAP, GUEST_COUNTER_LIMIT_MESSAGE, useCounters } from '../counters';
import { useSession } from '../session';

import type { ClientCounter } from '@tally/core/client';

export default function HomeScreen() {
    const router = useRouter();
    const network = useNetworkState();
    const session = useSession();
    const counterState = useCounters();
    const [formOpen, setFormOpen] = useState(false);
    const [counterToEdit, setCounterToEdit] = useState<ClientCounter | null>(null);
    const [guestLimitOpen, setGuestLimitOpen] = useState(false);

    function openCreateForm() {
        if (!session.isAuthenticated && counterState.eligibleCount >= GUEST_COUNTER_CAP) {
            setGuestLimitOpen(true);
            return;
        }

        setCounterToEdit(null);
        setFormOpen(true);
    }

    function closeForm() {
        setCounterToEdit(null);
        setFormOpen(false);
    }

    return (
        <>
            <Head>
                <title>Tally Tracker</title>
            </Head>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <View style={styles.brandRow}>
                        <Text accessibilityRole='header' aria-level={1} style={styles.headerTitle}>
                            Tally Counter
                        </Text>
                        {session.isPremium && <Text style={styles.premiumBadge}>Premium</Text>}
                    </View>
                    {session.isAuthenticated ? (
                        <View style={styles.headerActions}>
                            <Link href='/settings' asChild>
                                <Pressable
                                    accessibilityRole='link'
                                    style={styles.headerAction}
                                    testID='home-settings-link'
                                >
                                    <Text style={styles.headerActionText}>Settings</Text>
                                </Pressable>
                            </Link>
                            <Pressable
                                accessibilityRole='button'
                                onPress={() => void session.logout()}
                                style={styles.headerAction}
                                testID='home-logout'
                            >
                                <Text style={styles.headerActionText}>Logout</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <Link href='/login' asChild>
                            <Pressable accessibilityRole='link' style={styles.headerAction}>
                                <Text style={styles.headerActionText}>Login</Text>
                            </Pressable>
                        </Link>
                    )}
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
                    <View style={styles.content}>
                        <View style={styles.welcomeRow}>
                            <View style={styles.welcomeCopy}>
                                <Text style={styles.welcome}>Welcome {session.user?.email || 'Guest'}!</Text>
                                {!session.isAuthenticated && (
                                    <Text style={styles.guestCopy}>
                                        Your counters stay on this device until you sign in.
                                    </Text>
                                )}
                            </View>
                            {session.isAuthenticated && (
                                <View accessibilityLiveRegion='polite' style={styles.status}>
                                    <View
                                        style={[
                                            styles.statusDot,
                                            network.isConnected === false && styles.statusDotOffline,
                                        ]}
                                    />
                                    <Text style={styles.statusText}>
                                        {counterState.loading
                                            ? 'Syncing'
                                            : network.isConnected === false
                                              ? 'Offline'
                                              : 'Synced'}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {formOpen ? (
                            <CounterForm counter={counterToEdit || undefined} onCancel={closeForm} onDone={closeForm} />
                        ) : (
                            <Pressable
                                accessibilityRole='button'
                                onPress={openCreateForm}
                                style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
                                testID='add-counter-button'
                            >
                                <Text style={styles.addButtonText}>Add counter</Text>
                            </Pressable>
                        )}

                        {counterState.loading && counterState.counters.length === 0 ? (
                            <ActivityIndicator color='#0f7899' size='large' style={styles.loader} />
                        ) : counterState.counters.length ? (
                            <View style={styles.counterList} testID='counter-list'>
                                {counterState.counters.map((counter) => (
                                    <CounterCard
                                        key={counter.id}
                                        counter={counter}
                                        onDelete={(item) => void counterState.deleteCounter(item)}
                                        onEdit={(item) => {
                                            setCounterToEdit(item);
                                            setFormOpen(true);
                                        }}
                                        onIncrement={(id, amount) => void counterState.incrementCounter(id, amount)}
                                    />
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyTitle}>No counters yet</Text>
                                <Text style={styles.emptyCopy}>Add one to start tracking.</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>

                <Modal
                    animationType='fade'
                    onRequestClose={() => setGuestLimitOpen(false)}
                    transparent
                    visible={guestLimitOpen}
                >
                    <View accessibilityViewIsModal style={styles.modalOverlay} testID='guest-limit-modal'>
                        <View style={styles.modalCard}>
                            <Text accessibilityRole='header' aria-level={2} style={styles.modalTitle}>
                                {GUEST_COUNTER_LIMIT_MESSAGE}
                            </Text>
                            <Text style={styles.modalCopy}>
                                Guest sessions can create up to {GUEST_COUNTER_CAP} counters. Your existing counters
                                remain usable.
                            </Text>
                            <View style={styles.modalActions}>
                                <Pressable
                                    accessibilityRole='button'
                                    onPress={() => setGuestLimitOpen(false)}
                                    style={styles.modalSecondary}
                                >
                                    <Text style={styles.modalSecondaryText}>Close</Text>
                                </Pressable>
                                <Pressable
                                    accessibilityRole='button'
                                    onPress={() => {
                                        setGuestLimitOpen(false);
                                        router.push('/upgrade');
                                    }}
                                    style={styles.modalPrimary}
                                    testID='guest-limit-modal-upgrade'
                                >
                                    <Text style={styles.modalPrimaryText}>View upgrade info</Text>
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
        paddingHorizontal: 18,
        backgroundColor: '#0f7899',
    },
    brandRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '800',
    },
    premiumBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        color: '#5f3b00',
        fontSize: 11,
        fontWeight: '800',
        backgroundColor: '#ffe08a',
        borderRadius: 999,
    },
    headerAction: {
        minWidth: 56,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerActions: {
        flexDirection: 'row',
    },
    headerActionText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 20,
        paddingBottom: 42,
    },
    content: {
        width: '100%',
        maxWidth: 680,
        alignSelf: 'center',
        gap: 22,
    },
    welcomeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
    },
    welcomeCopy: {
        flex: 1,
        gap: 5,
    },
    welcome: {
        color: '#212529',
        fontSize: 24,
        fontWeight: '800',
    },
    guestCopy: {
        color: '#575e64',
        fontSize: 14,
        lineHeight: 20,
    },
    status: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 11,
        paddingVertical: 7,
        backgroundColor: '#ffffff',
        borderRadius: 999,
    },
    statusDot: {
        width: 8,
        height: 8,
        backgroundColor: '#15803d',
        borderRadius: 4,
    },
    statusDotOffline: {
        backgroundColor: '#b45309',
    },
    statusText: {
        color: '#343a40',
        fontSize: 13,
        fontWeight: '700',
    },
    addButton: {
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f7899',
        borderRadius: 10,
    },
    addButtonPressed: {
        backgroundColor: '#0d6f8f',
    },
    addButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '800',
    },
    loader: {
        marginTop: 40,
    },
    counterList: {
        gap: 16,
    },
    emptyState: {
        alignItems: 'center',
        gap: 6,
        padding: 36,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#dee2e6',
        borderRadius: 14,
    },
    emptyTitle: {
        color: '#343a40',
        fontSize: 18,
        fontWeight: '700',
    },
    emptyCopy: {
        color: '#575e64',
        fontSize: 14,
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
    modalActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 4,
    },
    modalSecondary: {
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#6c757d',
        borderRadius: 9,
    },
    modalSecondaryText: {
        color: '#343a40',
        fontWeight: '700',
    },
    modalPrimary: {
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        backgroundColor: '#0f7899',
        borderRadius: 9,
    },
    modalPrimaryText: {
        color: '#ffffff',
        fontWeight: '700',
    },
});
