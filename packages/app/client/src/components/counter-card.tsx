import * as Clipboard from 'expo-clipboard';
import { createURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    LayoutAnimationConfig,
    LinearTransition,
    ReduceMotion,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../colors';
import { REQUEST_FAILED_MESSAGE } from '../api';
import { useCounters } from '../counters';
import { useSession } from '../session';
import { CounterMenu } from './counter-menu';
import { CounterStepper } from './counter-stepper';

import type { ClientCounter } from '@tally/core/client';

type CounterCardProps = {
    counter: ClientCounter;
    onDelete: (counter: ClientCounter) => void;
    onEdit: (counter: ClientCounter) => void;
    onEditIncrement: (counter: ClientCounter) => void;
    onIncrement: (counterId: string, amount: number) => void;
    onNotice: (message: string) => void;
    canReorder: boolean;
    reordering: boolean;
    onReorder: () => void;
};

export function CounterCard({
    counter,
    onDelete,
    onEdit,
    onEditIncrement,
    onIncrement,
    onNotice,
    canReorder,
    reordering,
    onReorder,
}: CounterCardProps) {
    const { isPremium, user } = useSession();
    const router = useRouter();
    const { shareCounter, failedCounterIds } = useCounters();
    const [sharing, setSharing] = useState(false);
    const increment = counter.increment ?? 1;

    async function share() {
        if (!isPremium || sharing) return;
        if (!user?.emailVerified) {
            router.push({ pathname: '/verify-email', params: { email: user?.email, returnTo: '/home' } });
            return;
        }
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
        <LayoutAnimationConfig skipEntering>
            <Animated.View layout={counterLayoutTransition} style={styles.card} testID={`counter-${counter.id}`}>
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <Text
                            accessibilityRole='header'
                            aria-level={2}
                            numberOfLines={2}
                            style={styles.title}
                            testID={`counter-${counter.id}-title`}
                        >
                            {counter.title}
                        </Text>
                        {!reordering && Boolean(counter.metric) && (
                            <Animated.Text
                                entering={controlsEntering}
                                exiting={controlsExiting}
                                style={styles.metric}
                                testID={`counter-${counter.id}-metric`}
                            >
                                {counter.metric}
                            </Animated.Text>
                        )}
                    </View>
                    {reordering ? (
                        <Animated.View entering={controlsEntering} exiting={controlsExiting} style={styles.menuButton}>
                            <Svg aria-hidden width={24} height={24} viewBox='0 0 24 24' fill='none'>
                                <Path
                                    d='M5 7h14M5 12h14M5 17h14'
                                    stroke={colors.muted}
                                    strokeWidth={2}
                                    strokeLinecap='round'
                                />
                            </Svg>
                        </Animated.View>
                    ) : (
                        <Animated.View entering={controlsEntering} exiting={controlsExiting}>
                            <CounterMenu
                                counterId={counter.id}
                                title={counter.title}
                                isPremium={isPremium}
                                busy={sharing}
                                canReorder={canReorder}
                                onAction={(action) => {
                                    if (action === 'edit') onEdit(counter);
                                    else if (action === 'delete') onDelete(counter);
                                    else if (action === 'reorder') onReorder();
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
                        </Animated.View>
                    )}
                </View>

                {!reordering && (
                    <Animated.View entering={controlsEntering} exiting={controlsExiting} style={styles.controls}>
                        <CounterStepper
                            value={counter.count}
                            increment={increment}
                            label={counter.title}
                            testID={`counter-${counter.id}`}
                            onIncrement={(amount) => onIncrement(counter.id, amount)}
                        />

                        <View style={styles.footer}>
                            {counter.type === 'SHARED' && (
                                <View accessible accessibilityLabel='Shared counter' accessibilityRole='image'>
                                    <Svg
                                        aria-hidden
                                        width={20}
                                        height={20}
                                        viewBox='0 0 24 24'
                                        fill='none'
                                        stroke={colors.muted}
                                        strokeWidth={1.8}
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    >
                                        <Circle cx={9} cy={8} r={3} />
                                        <Path d='M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2' />
                                    </Svg>
                                </View>
                            )}
                            <Pressable
                                accessibilityLabel={`Change increment for ${counter.title}, currently ${increment}`}
                                accessibilityRole='button'
                                onPress={() => onEditIncrement(counter)}
                                style={({ pressed }) => [styles.incrementButton, pressed && styles.incrementPressed]}
                                testID={`counter-${counter.id}-increment`}
                            >
                                <Text style={styles.incrementText}>± {increment}</Text>
                            </Pressable>
                        </View>
                        {failedCounterIds.has(counter.id) && (
                            <Pressable
                                accessibilityRole='button'
                                accessibilityLabel={`Edit ${counter.title} to resolve its sync error`}
                                onPress={() => onEdit(counter)}
                                style={({ pressed }) => [styles.syncRecovery, pressed && styles.incrementPressed]}
                                testID={`counter-${counter.id}-sync-error`}
                            >
                                <Text accessibilityLiveRegion='polite' style={styles.syncError}>
                                    Not synced
                                </Text>
                                <Text style={styles.incrementText}>Edit</Text>
                            </Pressable>
                        )}
                    </Animated.View>
                )}
            </Animated.View>
        </LayoutAnimationConfig>
    );
}

export const counterLayoutTransition = LinearTransition.duration(280)
    .easing(Easing.out(Easing.cubic))
    .reduceMotion(ReduceMotion.System);
const controlsEntering = FadeIn.duration(180).delay(80).reduceMotion(ReduceMotion.System);
const controlsExiting = FadeOut.duration(120).reduceMotion(ReduceMotion.System);

const styles = StyleSheet.create({
    card: {
        gap: 18,
        paddingTop: 16,
        paddingRight: 20,
        paddingBottom: 20,
        paddingLeft: 26,
        backgroundColor: colors.surface,
        borderRadius: 16,
        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.12)',
        elevation: 3,
        overflow: 'hidden',
    },
    controls: { gap: 18 },
    syncRecovery: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 44,
        borderRadius: 8,
    },
    syncError: { color: colors.danger, fontSize: 14 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    title: {
        flexShrink: 1,
        color: colors.text,
        fontSize: 24,
        fontWeight: '700',
    },
    titleRow: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 8,
    },
    metric: {
        flexShrink: 1,
        color: colors.muted,
        fontSize: 14,
        lineHeight: 20,
    },
    incrementButton: {
        marginLeft: 'auto',
        minWidth: 48,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
    },
    incrementPressed: {
        backgroundColor: colors.input,
    },
    incrementText: {
        color: colors.link,
        fontSize: 16,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: -12,
        marginBottom: -12,
    },
    menuButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
