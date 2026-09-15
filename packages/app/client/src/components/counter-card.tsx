import * as Clipboard from 'expo-clipboard';
import { createURL } from 'expo-linking';
import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../colors';
import { REQUEST_FAILED_MESSAGE } from '../api';
import { useCounters } from '../counters';
import { useSession } from '../session';
import { CounterMenu } from './counter-menu';

import type { ClientCounter } from '@tally/core/client';

type CounterCardProps = {
    counter: ClientCounter;
    onDelete: (counter: ClientCounter) => void;
    onEdit: (counter: ClientCounter) => void;
    onIncrement: (counterId: string, amount: number) => void;
    onNotice: (message: string) => void;
    moveUp?: () => void;
    moveDown?: () => void;
};

export function CounterCard({ counter, onDelete, onEdit, onIncrement, onNotice, moveUp, moveDown }: CounterCardProps) {
    const { isPremium } = useSession();
    const { shareCounter } = useCounters();
    const [sharing, setSharing] = useState(false);

    async function share() {
        if (!isPremium || sharing) return;
        setSharing(true);
        onNotice('');
        try {
            const result = await shareCounter(counter.id);
            if (!result.success) {
                onNotice(result.message);
                return;
            }
            const url = createURL('/join', { queryParams: { code: result.inviteCode } });
            if (Platform.OS === 'web') {
                await Clipboard.setStringAsync(url);
                onNotice('Share link copied');
            } else {
                await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
            }
        } catch {
            onNotice(REQUEST_FAILED_MESSAGE);
        } finally {
            setSharing(false);
        }
    }

    return (
        <View style={[styles.card, { borderLeftColor: counter.color || '#343a40' }]} testID={`counter-${counter.id}`}>
            <View style={styles.header}>
                <Text accessibilityRole='header' aria-level={2} numberOfLines={2} style={styles.title}>
                    {counter.title}
                </Text>
                {counter.type === 'SHARED' && <Text style={styles.sharedBadge}>Shared</Text>}
                <CounterMenu
                    counterId={counter.id}
                    title={counter.title}
                    isPremium={isPremium}
                    busy={sharing}
                    moveUp={moveUp}
                    moveDown={moveDown}
                    onAction={(action) => {
                        if (action === 'edit') onEdit(counter);
                        else if (action === 'delete') onDelete(counter);
                        else void share();
                    }}
                >
                    <View style={styles.menuButton}>
                        <Svg aria-hidden width={24} height={24} viewBox='0 0 24 24' fill={colors.text}>
                            <Circle cx={5} cy={12} r={2} />
                            <Circle cx={12} cy={12} r={2} />
                            <Circle cx={19} cy={12} r={2} />
                        </Svg>
                    </View>
                </CounterMenu>
            </View>

            <View style={styles.counterRow}>
                <Pressable
                    accessibilityLabel={`Decrease ${counter.title}`}
                    accessibilityRole='button'
                    onPress={() => onIncrement(counter.id, -1)}
                    style={({ pressed }) => [styles.countButton, pressed && styles.buttonPressed]}
                    testID={`counter-${counter.id}-decrease`}
                >
                    <Svg aria-hidden width={24} height={24} viewBox='0 0 24 24' fill='none'>
                        <Path d='M5 12h14' stroke={colors.onPrimary} strokeWidth={2} strokeLinecap='round' />
                    </Svg>
                </Pressable>
                <Text
                    accessibilityLabel={`${counter.title} count ${counter.count}`}
                    style={styles.count}
                    testID={`counter-${counter.id}-count`}
                >
                    {counter.count}
                </Text>
                <Pressable
                    accessibilityLabel={`Increase ${counter.title}`}
                    accessibilityRole='button'
                    onPress={() => onIncrement(counter.id, 1)}
                    style={({ pressed }) => [styles.countButton, pressed && styles.buttonPressed]}
                    testID={`counter-${counter.id}-increase`}
                >
                    <Svg aria-hidden width={24} height={24} viewBox='0 0 24 24' fill='none'>
                        <Path d='M12 5v14M5 12h14' stroke={colors.onPrimary} strokeWidth={2} strokeLinecap='round' />
                    </Svg>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        gap: 18,
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: 28,
        backgroundColor: colors.surface,
        borderLeftWidth: 6,
        borderRadius: 14,
        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.12)',
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    title: {
        flex: 1,
        color: colors.text,
        fontSize: 24,
        fontWeight: '700',
    },
    sharedBadge: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        color: colors.link,
        fontSize: 12,
        fontWeight: '700',
        backgroundColor: colors.infoSurface,
        borderRadius: 999,
    },
    counterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
    },
    countButton: {
        width: 52,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        borderRadius: 26,
    },
    buttonPressed: {
        backgroundColor: colors.primaryPressed,
        transform: [{ scale: 0.97 }],
    },
    count: {
        minWidth: 80,
        color: colors.text,
        fontSize: 38,
        fontVariant: ['tabular-nums'],
        fontWeight: '800',
        textAlign: 'center',
    },
    menuButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
