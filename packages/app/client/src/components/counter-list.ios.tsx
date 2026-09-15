import { Host, List, RNHostView, VStack } from '@expo/ui/swift-ui';
import { View } from 'react-native';
import {
    contentShape,
    deleteDisabled,
    listRowBackground,
    listRowInsets,
    listRowSeparator,
    listStyle,
    moveDisabled,
    scrollContentBackground,
    shapes,
} from '@expo/ui/swift-ui/modifiers';

import type { CounterListProps } from './counter-list';

export function CounterList({ counters, onReorder, renderItem, emptyState }: CounterListProps) {
    const rowModifiers = [
        listRowBackground('#00000000'),
        listRowInsets({ top: 0, leading: 0, bottom: 16, trailing: 0 }),
        listRowSeparator('hidden'),
        deleteDisabled(true),
        contentShape(shapes.roundedRectangle({ cornerRadius: 14 }), 'dragPreview'),
    ];

    return (
        <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20 }}>
            <Host style={{ flex: 1 }} colorScheme='dark' ignoreSafeArea='all'>
                <List modifiers={[listStyle('plain'), scrollContentBackground('hidden')]}>
                    <List.ForEach
                        onMove={(sources, destination) => {
                            const ids = counters.map((counter) => counter.id);
                            const moving = ids.filter((_, index) => sources.includes(index));
                            const remaining = ids.filter((_, index) => !sources.includes(index));
                            remaining.splice(
                                destination - sources.filter((index) => index < destination).length,
                                0,
                                ...moving,
                            );
                            onReorder(remaining);
                        }}
                    >
                        {counters.map((counter, index) => (
                            <VStack key={counter.id} modifiers={[...rowModifiers, moveDisabled(counters.length < 2)]}>
                                <RNHostView matchContents>
                                    <>{renderItem(counter, index)}</>
                                </RNHostView>
                            </VStack>
                        ))}
                    </List.ForEach>
                    {!counters.length && (
                        <VStack modifiers={rowModifiers}>
                            <RNHostView matchContents>
                                <>{emptyState}</>
                            </RNHostView>
                        </VStack>
                    )}
                </List>
            </Host>
        </View>
    );
}
