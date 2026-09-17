import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useNetworkState } from 'expo-network';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../colors';
import { CounterCard } from '../components/counter-card';
import { CounterForm } from '../components/counter-form';
import { CounterIncrementDialog } from '../components/counter-increment-dialog';
import { CounterList } from '../components/counter-list';
import { Dialog } from '../components/dialog';
import { Snackbar } from '../components/snackbar';
import { SyncIndicator } from '../components/sync-indicator';
import { TallyBrand } from '../components/tally-brand';
import { ToolbarButton } from '../components/toolbar-button';
import { GUEST_COUNTER_CAP, GUEST_COUNTER_LIMIT_MESSAGE, orderCounters, useCounters } from '../counters';
import { useSession } from '../session';

import type { ClientCounter } from '@tally/core/client';

export default function HomeScreen() {
    const router = useRouter();
    const network = useNetworkState();
    const session = useSession();
    const counterState = useCounters();
    const insets = useSafeAreaInsets();
    const [formOpen, setFormOpen] = useState(false);
    const [counterToEdit, setCounterToEdit] = useState<ClientCounter | null>(null);
    const [incrementToEdit, setIncrementToEdit] = useState<ClientCounter | null>(null);
    const [guestLimitOpen, setGuestLimitOpen] = useState(false);
    const [notice, setNotice] = useState('');
    const [reorderDraft, setReorderDraft] = useState<string[] | null>(null);
    const [savingOrder, setSavingOrder] = useState(false);
    const [pulling, setPulling] = useState(false);
    const reordering = reorderDraft !== null;

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

    async function reorderCounters(ids: string[]) {
        if (reordering) {
            setReorderDraft((draft) => (draft ? ids : null));
            return;
        }
        const result = await counterState.reorderCounters(ids);
        if (!result.success) setNotice(result.message);
    }

    async function finishReordering() {
        if (!reorderDraft || savingOrder) return;
        setSavingOrder(true);
        const result = await counterState.reorderCounters(reorderDraft);
        setSavingOrder(false);
        if (result.success) setReorderDraft(null);
        else setNotice(result.message);
    }

    async function incrementCounter(id: string, amount: number) {
        const result = await counterState.incrementCounter(id, amount);
        if (!result.success) setNotice(result.message);
    }

    return (
        <>
            <Head>
                <title>Tally</title>
            </Head>
            <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
                <View style={styles.header}>
                    <View style={styles.brandRow}>
                        {reordering ? (
                            <ToolbarButton
                                label='Cancel'
                                role='cancel'
                                disabled={savingOrder}
                                onPress={() => setReorderDraft(null)}
                                testID='counter-reorder-cancel'
                            />
                        ) : (
                            <TallyBrand style={styles.brand} />
                        )}
                    </View>
                    {reordering ? (
                        <ToolbarButton
                            label='Done'
                            disabled={savingOrder}
                            onPress={() => void finishReordering()}
                            testID='counter-reorder-done'
                        />
                    ) : session.isAuthenticated ? (
                        <View style={styles.headerActions}>
                            <SyncIndicator
                                status={
                                    counterState.loading || counterState.refreshing || pulling
                                        ? 'syncing'
                                        : network.isConnected === false
                                          ? 'offline'
                                          : counterState.syncError
                                            ? 'error'
                                            : 'synced'
                                }
                            />
                            <Link href='/settings' asChild>
                                <Pressable
                                    accessibilityLabel='Settings'
                                    accessibilityRole='link'
                                    style={styles.settingsButton}
                                    testID='home-settings-link'
                                >
                                    <Svg
                                        aria-hidden
                                        width={24}
                                        height={24}
                                        viewBox='0 0 24 24'
                                        fill='none'
                                        stroke={colors.text}
                                        strokeWidth={2}
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    >
                                        <Path d='M10 2h4l.5 3.5 1.5.9 3.3-1.3 2 3.5-2.8 2.2v2.4l2.8 2.2-2 3.5-3.3-1.3-1.5.9L14 22h-4l-.5-3.5-1.5-.9-3.3 1.3-2-3.5 2.8-2.2v-2.4L2.7 8.6l2-3.5L8 6.4l1.5-.9Z' />
                                        <Circle cx={12} cy={12} r={3} />
                                    </Svg>
                                </Pressable>
                            </Link>
                        </View>
                    ) : (
                        <Link href='/login' asChild>
                            <Pressable accessibilityRole='link' style={styles.headerAction}>
                                <Text style={styles.headerActionText}>Login</Text>
                            </Pressable>
                        </Link>
                    )}
                </View>

                <CounterList
                    counters={reorderDraft ? orderCounters(counterState.counters, reorderDraft) : counterState.counters}
                    reordering={reordering}
                    refreshing={counterState.refreshing}
                    onRefresh={session.isAuthenticated ? counterState.refreshCounters : undefined}
                    onPullChange={setPulling}
                    onReorder={(ids) => void reorderCounters(ids)}
                    emptyState={
                        counterState.loading && !counterState.refreshing ? (
                            <ActivityIndicator color={colors.link} size='large' style={styles.loader} />
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyTitle}>No counters yet</Text>
                            </View>
                        )
                    }
                    renderItem={(counter) => (
                        <CounterCard
                            key={counter.id}
                            counter={counter}
                            onDelete={(item) => void counterState.deleteCounter(item)}
                            onEdit={(item) => {
                                setCounterToEdit(item);
                                setFormOpen(true);
                            }}
                            onEditIncrement={setIncrementToEdit}
                            onIncrement={(id, amount) => void incrementCounter(id, amount)}
                            onNotice={setNotice}
                            canReorder={counterState.counters.length > 1}
                            reordering={reordering}
                            onReorder={() => {
                                if (counterState.counters.length > 1)
                                    setReorderDraft(counterState.counters.map((item) => item.id));
                            }}
                        />
                    )}
                />

                {!reordering && (
                    <View pointerEvents='box-none' style={[styles.bottomActions, { bottom: insets.bottom }]}>
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
                )}

                <CounterForm
                    visible={formOpen}
                    counter={counterToEdit || undefined}
                    onCancel={closeForm}
                    onDone={closeForm}
                />

                {incrementToEdit && (
                    <CounterIncrementDialog counter={incrementToEdit} onClose={() => setIncrementToEdit(null)} />
                )}

                <Dialog
                    onRequestClose={() => setGuestLimitOpen(false)}
                    visible={guestLimitOpen}
                    testID='guest-limit-modal'
                    title={GUEST_COUNTER_LIMIT_MESSAGE}
                    description={`Guest sessions can create up to ${GUEST_COUNTER_CAP} counters. Your existing counters remain usable.`}
                    descriptionGap={8}
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
                            <Text style={styles.modalPrimaryText}>Upgrade</Text>
                        </Pressable>
                    </View>
                </Dialog>
                <Snackbar message={notice} onDismiss={() => setNotice('')} />
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
        paddingHorizontal: 20,
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
    headerAction: {
        minWidth: 56,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    settingsButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 22,
    },
    headerActionText: {
        color: colors.onPrimary,
        fontSize: 14,
        fontWeight: '700',
    },
    bottomActions: {
        position: 'absolute',
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
