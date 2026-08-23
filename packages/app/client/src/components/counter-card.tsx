import * as Clipboard from 'expo-clipboard';
import { createURL } from 'expo-linking';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClientCounter } from '@tally/core/client';

type CounterCardProps = {
    counter: ClientCounter;
    onDelete: (counter: ClientCounter) => void;
    onEdit: (counter: ClientCounter) => void;
    onIncrement: (counterId: string, amount: number) => void;
};

export function CounterCard({ counter, onDelete, onEdit, onIncrement }: CounterCardProps) {
    async function copyShareLink() {
        if (!counter.inviteCode) return;
        await Clipboard.setStringAsync(createURL('/join', { queryParams: { code: counter.inviteCode } }));
        Alert.alert('Share link copied');
    }

    return (
        <View style={[styles.card, { borderLeftColor: counter.color || '#343a40' }]} testID={`counter-${counter.id}`}>
            <View style={styles.header}>
                <Text accessibilityRole='header' aria-level={2} numberOfLines={2} style={styles.title}>
                    {counter.title}
                </Text>
                {counter.type === 'SHARED' && <Text style={styles.sharedBadge}>Shared</Text>}
            </View>

            <View style={styles.counterRow}>
                <Pressable
                    accessibilityLabel={`Decrease ${counter.title}`}
                    accessibilityRole='button'
                    onPress={() => onIncrement(counter.id, -1)}
                    style={({ pressed }) => [styles.countButton, pressed && styles.buttonPressed]}
                    testID={`counter-${counter.id}-decrease`}
                >
                    <Text style={styles.countButtonText}>−</Text>
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
                    <Text style={styles.countButtonText}>+</Text>
                </Pressable>
            </View>

            <View style={styles.actions}>
                <Pressable accessibilityRole='button' hitSlop={6} onPress={() => onEdit(counter)}>
                    <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                {counter.type === 'SHARED' && counter.inviteCode && (
                    <Pressable accessibilityRole='button' hitSlop={6} onPress={() => void copyShareLink()}>
                        <Text style={styles.actionText}>Share</Text>
                    </Pressable>
                )}
                <Pressable accessibilityRole='button' hitSlop={6} onPress={() => onDelete(counter)}>
                    <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        gap: 18,
        padding: 20,
        backgroundColor: '#ffffff',
        borderLeftWidth: 6,
        borderRadius: 14,
        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.12)',
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    title: {
        flex: 1,
        color: '#212529',
        fontSize: 20,
        fontWeight: '700',
    },
    sharedBadge: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        color: '#075985',
        fontSize: 12,
        fontWeight: '700',
        backgroundColor: '#e0f2fe',
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
        backgroundColor: '#0f7899',
        borderRadius: 26,
    },
    buttonPressed: {
        backgroundColor: '#0d6f8f',
        transform: [{ scale: 0.97 }],
    },
    countButtonText: {
        color: '#ffffff',
        fontSize: 30,
        fontWeight: '500',
        lineHeight: 34,
    },
    count: {
        minWidth: 80,
        color: '#212529',
        fontSize: 38,
        fontVariant: ['tabular-nums'],
        fontWeight: '800',
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 22,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
    },
    actionText: {
        color: '#167ca3',
        fontSize: 14,
        fontWeight: '700',
    },
    deleteText: {
        color: '#b42318',
        fontSize: 14,
        fontWeight: '700',
    },
});
