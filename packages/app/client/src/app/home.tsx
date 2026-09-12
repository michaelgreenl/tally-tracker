import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useNetworkState } from 'expo-network';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../colors';
import { CounterCard } from '../components/counter-card';
import { CounterForm } from '../components/counter-form';
import { Dialog } from '../components/dialog';
import { TallyBrand } from '../components/tally-brand';
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
        setFormOpen(false);
    }

    return (
        <>
            <Head>
                <title>Tally</title>
            </Head>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <View style={styles.brandRow}>
                        <TallyBrand style={styles.brand} />
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
                        {session.isAuthenticated && (
                            <View accessibilityLiveRegion='polite' style={styles.status}>
                                <View
                                    style={[
                                        styles.statusDot,
                                        network.isConnected === false && styles.statusDotOffline,
                                        network.isConnected !== false &&
                                            counterState.syncError &&
                                            styles.statusDotError,
                                    ]}
                                />
                                <Text style={styles.statusText}>
                                    {counterState.loading
                                        ? 'Syncing'
                                        : network.isConnected === false
                                          ? 'Offline'
                                          : counterState.syncError
                                            ? 'Sync failed'
                                            : 'Synced'}
                                </Text>
                            </View>
                        )}

                        {counterState.loading && counterState.counters.length === 0 ? (
                            <ActivityIndicator color={colors.link} size='large' style={styles.loader} />
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
                            </View>
                        )}
                    </View>
                </ScrollView>

                <View style={styles.bottomActions}>
                    <Pressable
                        accessibilityLabel='Add counter'
                        accessibilityRole='button'
                        onPress={openCreateForm}
                        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
                        testID='add-counter-button'
                    >
                        <Svg aria-hidden width={24} height={24} viewBox='0 0 24 24' fill='none'>
                            <Path
                                d='M12 5v14M5 12h14'
                                stroke={colors.onPrimary}
                                strokeWidth={2}
                                strokeLinecap='round'
                            />
                        </Svg>
                    </Pressable>
                </View>

                <CounterForm
                    visible={formOpen}
                    counter={counterToEdit || undefined}
                    onCancel={closeForm}
                    onDone={closeForm}
                />

                <Dialog
                    onRequestClose={() => setGuestLimitOpen(false)}
                    visible={guestLimitOpen}
                    testID='guest-limit-modal'
                    title={GUEST_COUNTER_LIMIT_MESSAGE}
                    description={`Guest sessions can create up to ${GUEST_COUNTER_CAP} counters. Your existing counters remain usable.`}
                >
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingHorizontal: 32,
        paddingVertical: 16,
        backgroundColor: colors.background,
    },
    brandRow: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
    },
    brand: {
        fontSize: 24,
    },
    premiumBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        color: colors.warning,
        fontSize: 11,
        fontWeight: '800',
        backgroundColor: colors.warningSurface,
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
        color: colors.onPrimary,
        fontSize: 14,
        fontWeight: '700',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 20,
    },
    content: {
        width: '100%',
        maxWidth: 680,
        alignSelf: 'center',
        gap: 22,
    },
    status: {
        alignSelf: 'flex-end',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 11,
        paddingVertical: 7,
        backgroundColor: colors.surface,
        borderRadius: 999,
    },
    statusDot: {
        width: 8,
        height: 8,
        backgroundColor: colors.success,
        borderRadius: 4,
    },
    statusDotOffline: {
        backgroundColor: colors.warning,
    },
    statusDotError: {
        backgroundColor: colors.danger,
    },
    statusText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    bottomActions: {
        width: '100%',
        maxWidth: 720,
        alignSelf: 'center',
        alignItems: 'flex-end',
        padding: 20,
    },
    addButton: {
        width: 52,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        borderRadius: 26,
    },
    addButtonPressed: {
        backgroundColor: colors.primaryPressed,
    },
    loader: {
        marginTop: 40,
    },
    counterList: {
        gap: 16,
    },
    emptyState: {
        alignItems: 'center',
        padding: 36,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.divider,
        borderRadius: 14,
    },
    emptyTitle: {
        color: colors.muted,
        fontSize: 18,
        fontWeight: '500',
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
        borderColor: colors.border,
        borderRadius: 9,
    },
    modalSecondaryText: {
        color: colors.text,
        fontWeight: '700',
    },
    modalPrimary: {
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        backgroundColor: colors.primary,
        borderRadius: 9,
    },
    modalPrimaryText: {
        color: colors.onPrimary,
        fontWeight: '700',
    },
});
