import { Platform, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReorderableList, { reorderItems, useIsActive, useReorderableDrag } from 'react-native-reorderable-list';

import { colors } from '../colors';
import { counterLayoutTransition } from './counter-card';

import type { ClientCounter } from '@tally/core/client';
import type { KeyboardEvent, ReactNode } from 'react';

export type CounterListProps = {
    counters: ClientCounter[];
    reordering: boolean;
    onReorder: (ids: string[]) => void;
    renderItem: (counter: ClientCounter, index: number) => ReactNode;
    emptyState: ReactNode;
};

function DraggableCard({
    children,
    enabled,
    counter,
    index,
    count,
    move,
}: {
    children: ReactNode;
    enabled: boolean;
    counter: ClientCounter;
    index: number;
    count: number;
    move: (offset: number) => void;
}) {
    const drag = useReorderableDrag();
    const active = useIsActive();
    function startDrag() {
        if (Platform.OS === 'android') Vibration.vibrate(10);
        drag();
    }
    return (
        <Pressable
            accessible={enabled}
            focusable={enabled}
            tabIndex={enabled ? 0 : -1}
            accessibilityRole={enabled ? 'adjustable' : undefined}
            accessibilityLabel={enabled ? `Reorder ${counter.title}` : undefined}
            aria-valuemin={enabled ? 1 : undefined}
            aria-valuemax={enabled ? count : undefined}
            aria-valuenow={enabled ? index + 1 : undefined}
            aria-valuetext={enabled ? `Position ${index + 1} of ${count}` : undefined}
            accessibilityHint='Drag to move. Use the up and down arrow keys with a keyboard.'
            accessibilityActions={[
                { name: 'decrement', label: 'Move up' },
                { name: 'increment', label: 'Move down' },
            ]}
            onAccessibilityAction={({ nativeEvent }) => {
                if (!enabled) return;
                if (nativeEvent.actionName === 'decrement') move(-1);
                if (nativeEvent.actionName === 'increment') move(1);
            }}
            {...(Platform.OS === 'web' && enabled
                ? {
                      delayPressIn: 0,
                      onKeyDown: (event: KeyboardEvent) => {
                          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                              event.preventDefault();
                              move(event.key === 'ArrowUp' ? -1 : 1);
                          }
                      },
                  }
                : {})}
            onPressIn={
                enabled
                    ? (event) => {
                          if ('key' in event.nativeEvent) return;
                          startDrag();
                      }
                    : undefined
            }
            onLongPress={!enabled && count > 1 ? startDrag : undefined}
            style={styles.row}
            testID={`counter-${counter.id}-drag`}
        >
            <View
                pointerEvents={enabled || active ? 'none' : 'auto'}
                accessibilityElementsHidden={enabled}
                importantForAccessibility={enabled ? 'no-hide-descendants' : 'auto'}
                style={active && styles.lifted}
            >
                {children}
            </View>
        </Pressable>
    );
}

export function CounterList({ counters, reordering, onReorder, renderItem, emptyState }: CounterListProps) {
    const reduceMotion = useReducedMotion();
    const insets = useSafeAreaInsets();
    return (
        <GestureHandlerRootView style={styles.container}>
            <ReorderableList
                data={counters}
                keyExtractor={(counter) => counter.id}
                contentContainerStyle={[styles.content, { paddingBottom: 92 + insets.bottom }]}
                testID={counters.length ? 'counter-list' : undefined}
                ListEmptyComponent={<View>{emptyState}</View>}
                dragEnabled={counters.length > 1}
                // Leave ordinary swipes available until the 500ms long press has fired.
                panActivateAfterLongPress={reordering ? 0 : 520}
                shouldUpdateActiveItem
                animationDuration={reduceMotion ? 0 : 200}
                itemLayoutAnimation={counterLayoutTransition}
                cellAnimations={reduceMotion ? { opacity: 1, transform: [] } : { opacity: 1 }}
                onReorder={({ from, to }) => onReorder(reorderItems(counters, from, to).map((counter) => counter.id))}
                renderDropIndicator={() => <View style={styles.dropIndicator} />}
                renderItem={({ item, index }) => (
                    <DraggableCard
                        counter={item}
                        index={index}
                        count={counters.length}
                        enabled={reordering && counters.length > 1}
                        move={(offset) => {
                            const to = index + offset;
                            if (to >= 0 && to < counters.length)
                                onReorder(reorderItems(counters, index, to).map((counter) => counter.id));
                        }}
                    >
                        {renderItem(item, index)}
                    </DraggableCard>
                )}
            />
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
    content: { flexGrow: 1, paddingHorizontal: 20 },
    row: { paddingBottom: 16 },
    lifted: { borderRadius: 16, boxShadow: '0 6px 12px #0006', elevation: 8 },
    dropIndicator: {
        flex: 1,
        marginBottom: 16,
        borderRadius: 16,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.link,
        backgroundColor: colors.infoSurface,
    },
});
