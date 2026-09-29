import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCounters } from '../../contexts/counter-context';
import { useSession } from '../../contexts/session-context';
import { getErrorMessage } from '../../infra/http/api';
import { subscribeToCounterUpdates } from '../../infra/socket/socket';
import { CounterService } from '../../services/counters/counter.service';
import { getSessionScope } from '../../services/session/session-scope';
import { colors } from '../../theme/colors';
import { relativeTime } from '../../utils/relative-time';
import { MessageText } from '../shared/message-text';
import { ToolbarButton } from '../shared/toolbar-button';
import { CounterSheet } from './counter-sheet';

import type { ClientCounter, CounterMember } from '@tally/core/client';

export function CounterMembersSheet({ counter, onClose }: { counter?: ClientCounter; onClose: () => void }) {
    const { user } = useSession();
    const { onlineUserIds } = useCounters();
    const insets = useSafeAreaInsets();
    const [members, setMembers] = useState<CounterMember[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);
    const [now, setNow] = useState(Date.now);
    const counterId = counter?.id;
    const [displayedCounterId, setDisplayedCounterId] = useState(counterId);

    if (counterId !== displayedCounterId) {
        setDisplayedCounterId(counterId);
        setMembers([]);
        setError('');
        setLoading(true);
    }

    useEffect(() => {
        if (!counterId) return;
        const scope = getSessionScope();
        let version = 0;
        const refresh = () => {
            const request = ++version;
            void CounterService.members(counterId, scope)
                .then((response) => {
                    if (request !== version || scope !== getSessionScope()) return;
                    if (!response.success) throw new Error(response.message);
                    setMembers(response.data ?? []);
                    setNow(Date.now());
                    setError('');
                })
                .catch((error: unknown) => {
                    if (request !== version || scope !== getSessionScope()) return;
                    setMembers([]);
                    setError(getErrorMessage(error, 'Could not load members.'));
                })
                .finally(() => {
                    if (request === version) setLoading(false);
                });
        };
        refresh();
        const unsubscribe = subscribeToCounterUpdates(refresh, refresh);
        const foreground = AppState.addEventListener('change', (state) => {
            if (state === 'active') refresh();
        });
        const clock = setInterval(() => setNow(Date.now()), 1000);
        return () => {
            version += 1;
            unsubscribe();
            foreground.remove();
            clearInterval(clock);
        };
    }, [counterId, retry]);

    return (
        <CounterSheet
            visible={Boolean(counter)}
            loading={false}
            onDismiss={onClose}
            testID='counter-members-sheet'
            footer={
                <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
                    <ToolbarButton label='Done' onPress={onClose} testID='counter-members-close' />
                </View>
            }
        >
            <View style={styles.sheet}>
                <View style={styles.header}>
                    <Text accessibilityRole='header' style={styles.heading}>
                        Members
                    </Text>
                    <Text numberOfLines={1} style={styles.counterTitle}>
                        {counter?.title}
                    </Text>
                </View>
                <ScrollView contentContainerStyle={styles.list} testID='counter-members-list'>
                    {loading ? (
                        <ActivityIndicator color={colors.link} accessibilityLabel='Loading members' />
                    ) : error ? (
                        <View style={styles.error}>
                            <MessageText accessibilityRole='alert' style={styles.errorText}>
                                {error}
                            </MessageText>
                            <Pressable
                                accessibilityRole='button'
                                onPress={() => {
                                    setLoading(true);
                                    setRetry((value) => value + 1);
                                }}
                                style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
                                testID='counter-members-retry'
                            >
                                <Text style={styles.retryText}>Try again</Text>
                            </Pressable>
                        </View>
                    ) : (
                        members.map((member) => {
                            const online = onlineUserIds.has(member.id);
                            const role = [member.isOwner ? 'Owner' : '', member.id === user?.id ? 'You' : '']
                                .filter(Boolean)
                                .join(' · ');
                            const action = member.lastAction;
                            return (
                                <View key={member.id} style={styles.member} testID={`counter-member-${member.id}`}>
                                    <View style={styles.row}>
                                        <Text numberOfLines={1} style={styles.username}>
                                            {member.username ?? 'Member'}
                                        </Text>
                                        <View style={styles.status}>
                                            <View aria-hidden style={[styles.dot, online && styles.onlineDot]} />
                                            <Text style={[styles.statusText, online && styles.onlineText]}>
                                                {online ? 'Online' : 'Offline'}
                                            </Text>
                                        </View>
                                    </View>
                                    {Boolean(role) && <Text style={styles.role}>{role}</Text>}
                                    {action ? (
                                        <View style={styles.action}>
                                            <Text style={styles.amount}>
                                                {action.amount > 0 ? '+' : ''}
                                                {action.amount}
                                            </Text>
                                            <Text numberOfLines={1} style={styles.actionCounter}>
                                                {counter?.title}
                                            </Text>
                                            <Text style={styles.age}>{relativeTime(action.at, now)}</Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.noAction}>No count changes yet</Text>
                                    )}
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            </View>
        </CounterSheet>
    );
}

const styles = StyleSheet.create({
    sheet: { ...(Platform.OS === 'web' ? { flexShrink: 1 } : { flex: 1 }), backgroundColor: colors.surface },
    header: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16, gap: 6 },
    heading: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
    counterTitle: { color: colors.muted, fontSize: 15, textAlign: 'center' },
    list: { paddingHorizontal: 22, paddingBottom: 8 },
    member: {
        paddingVertical: 18,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
        gap: 4,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    username: { flex: 1, minWidth: 0, color: colors.text, fontSize: 18, fontWeight: '600' },
    role: { color: colors.muted, fontSize: 13 },
    status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.muted },
    onlineDot: { backgroundColor: colors.link, borderColor: colors.link },
    statusText: { color: colors.muted, fontSize: 13 },
    onlineText: { color: colors.link },
    action: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    amount: { color: colors.link, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 },
    actionCounter: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 15 },
    age: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
    noAction: { marginTop: 8, color: colors.muted, fontSize: 14 },
    footer: { alignItems: 'flex-end', paddingHorizontal: 22, paddingTop: 12 },
    error: { alignItems: 'center', gap: 8 },
    errorText: { color: colors.danger, fontSize: 15 },
    retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
    pressed: { opacity: 0.7 },
    retryText: { color: colors.link, fontSize: 16, fontWeight: '600' },
});
