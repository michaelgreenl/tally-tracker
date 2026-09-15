import { Platform, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import ReorderableList, { reorderItems, useIsActive, useReorderableDrag } from 'react-native-reorderable-list';

import { colors } from '../colors';

import type { ClientCounter } from '@tally/core/client';
import type { ReactNode } from 'react';

export type CounterListProps = {
    counters: ClientCounter[];
    onReorder: (ids: string[]) => void;
    renderItem: (counter: ClientCounter, index: number) => ReactNode;
    emptyState: ReactNode;
};

function DraggableCard({ children, enabled, id }: { children: ReactNode; enabled: boolean; id: string }) {
    const drag = useReorderableDrag();
    const active = useIsActive();
    return (
        <Pressable
            accessible={false}
            focusable={false}
            onLongPress={
                enabled
                    ? () => {
                          if (Platform.OS === 'android') Vibration.vibrate(10);
                          drag();
                      }
                    : undefined
            }
            style={styles.row}
            testID={`counter-${id}-drag`}
        >
            <View pointerEvents={active ? 'none' : 'auto'} style={active && styles.lifted}>
                {children}
            </View>
        </Pressable>
    );
}

export function CounterList({ counters, onReorder, renderItem, emptyState }: CounterListProps) {
    const reduceMotion = useReducedMotion();
    return (
        <GestureHandlerRootView style={styles.container}>
            <ReorderableList
                data={counters}
                keyExtractor={(counter) => counter.id}
                contentContainerStyle={styles.content}
                testID={counters.length ? 'counter-list' : undefined}
                ListEmptyComponent={<View>{emptyState}</View>}
                dragEnabled={counters.length > 1}
                panActivateAfterLongPress={520}
                shouldUpdateActiveItem
                animationDuration={reduceMotion ? 0 : 200}
                cellAnimations={reduceMotion ? { opacity: 1, transform: [] } : { opacity: 1 }}
                onReorder={({ from, to }) => onReorder(reorderItems(counters, from, to).map((counter) => counter.id))}
                renderDropIndicator={() => <View style={styles.dropIndicator} />}
                renderItem={({ item, index }) => (
                    <DraggableCard id={item.id} enabled={counters.length > 1}>
                        {renderItem(item, index)}
                    </DraggableCard>
                )}
            />
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
    content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 4 },
    row: { paddingBottom: 16 },
    lifted: { borderRadius: 14, boxShadow: '0 8px 20px #0006', elevation: 8 },
    dropIndicator: {
        flex: 1,
        marginBottom: 16,
        borderRadius: 14,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.link,
        backgroundColor: colors.infoSurface,
    },
});
