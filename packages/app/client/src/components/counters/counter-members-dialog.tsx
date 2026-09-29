import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useCounters } from '../../contexts/counter-context';
import { getErrorMessage } from '../../infra/http/api';
import { subscribeToCounterUpdates } from '../../infra/socket/socket';
import { CounterService } from '../../services/counters/counter.service';
import { getSessionScope } from '../../services/session/session-scope';
import { colors } from '../../theme/colors';
import { relativeTime } from '../../utils/relative-time';
import { MessageText } from '../shared/message-text';
import { ToolbarButton } from '../shared/toolbar-button';
import { Dialog } from '../shared/dialog';

import type { ClientCounter, CounterMember } from '@tally/core/client';

export function CounterMembersDialog({ counter, onClose }: { counter?: ClientCounter; onClose: () => void }) {
    const { onlineUserIds } = useCounters();
    const [members, setMembers] = useState<CounterMember[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);
    const [openedAt, setOpenedAt] = useState(Date.now);
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
        return () => {
            version += 1;
            unsubscribe();
            foreground.remove();
        };
    }, [counterId, retry]);

    return (
        <Dialog
            visible={Boolean(counter)}
            onRequestClose={onClose}
            onShow={() => setOpenedAt(Date.now())}
            dismissOnBackdropPress
            title={counter?.title ?? ''}
            testID='counter-members-dialog'
            trailingAction={
                <ToolbarButton label='Close' icon='close' onPress={onClose} testID='counter-members-close' />
            }
        >
            <View testID='counter-members-list'>
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
                        const action = member.lastAction;
                        return (
                            <View key={member.id} style={styles.member} testID={`counter-member-${member.id}`}>
                                <View style={styles.identity}>
                                    {member.isOwner && (
                                        <Svg
                                            accessibilityLabel='Owner'
                                            accessibilityRole='image'
                                            width={20}
                                            height={20}
                                            viewBox='0 0 24 24'
                                            fill={colors.text}
                                        >
                                            <Path d='M17.0016031,15.2440856 L17.0009052,21.2451182 C17.0009052,21.8527788 16.3161092,22.2081862 15.8192057,21.8584172 L12.0007623,19.1706254 L8.18435794,21.8583162 C7.68747081,22.2082475 7.00251516,21.8528589 7.00251516,21.2451182 L7.00069412,15.2459273 C8.37018531,16.3435035 10.1084262,17 12,17 C13.8926316,17 15.6317588,16.3427691 17.0016031,15.2440856 Z M12,2 C15.8659932,2 19,5.13400675 19,9 C19,12.8659932 15.8659932,16 12,16 C8.13400675,16 5,12.8659932 5,9 C5,5.13400675 8.13400675,2 12,2 Z' />
                                        </Svg>
                                    )}
                                    <Text
                                        numberOfLines={1}
                                        style={styles.username}
                                        testID={`counter-member-${member.id}-username`}
                                    >
                                        {member.username ?? 'Member'}
                                    </Text>
                                    <View
                                        accessible
                                        accessibilityRole='image'
                                        accessibilityLabel={online ? 'Online' : 'Offline'}
                                        style={[styles.dot, online && styles.onlineDot]}
                                        testID={`counter-member-${member.id}-presence`}
                                    />
                                </View>
                                {action && (
                                    <View style={styles.action}>
                                        <Text numberOfLines={1} style={styles.amount}>
                                            {action.amount > 0 ? '+' : ''}
                                            {action.amount}
                                        </Text>
                                        <Text
                                            numberOfLines={1}
                                            style={styles.age}
                                            testID={`counter-member-${member.id}-age`}
                                        >
                                            {relativeTime(action.at, openedAt)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </View>
        </Dialog>
    );
}

const styles = StyleSheet.create({
    member: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
        gap: 16,
    },
    identity: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
    username: { flexShrink: 1, color: colors.text, fontSize: 18, fontWeight: '600' },
    dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.muted, flexShrink: 0 },
    onlineDot: { backgroundColor: colors.success, borderColor: colors.success },
    action: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    amount: { color: colors.link, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 },
    age: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
    error: { alignItems: 'center', gap: 8 },
    errorText: { color: colors.danger, fontSize: 15 },
    retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
    pressed: { opacity: 0.7 },
    retryText: { color: colors.link, fontSize: 16, fontWeight: '600' },
});
