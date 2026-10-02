import { Button, Host, List, RNHostView, SwipeActions } from '@expo/ui/swift-ui';
import { Children, cloneElement } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
    accessibilityLabel,
    disabled as disable,
    environment,
    frame,
    listRowBackground,
    listRowInsets,
    listRowSeparator,
    listRowSpacing,
    listStyle,
    scrollContentBackground,
    tint,
} from '@expo/ui/swift-ui/modifiers';

import { colors } from '../../theme/colors';

import type { CounterMembersListProps, CounterMembersListRowProps } from './counter-members-list';

const rowGap = 8;
// Match the 10pt trailing inset measured on the native swipe action.
const trailingInset = Number(Platform.Version) >= 26 ? 10 : 0;

export function getCounterMemberRowHeight(fontScale: number) {
    return Math.max(64, Math.ceil(44 * fontScale) + rowGap);
}

function getSwipeHeight(fontScale: number) {
    return Math.max(52, Math.ceil(24 * fontScale) + 16);
}

export function CounterMembersList({ children, height }: CounterMembersListProps) {
    const { fontScale } = useWindowDimensions();
    const rowHeight = getCounterMemberRowHeight(fontScale);
    const spacing = rowHeight - getSwipeHeight(fontScale);
    return (
        <View style={{ height, paddingVertical: spacing / 2 }}>
            <Host style={{ flex: 1, marginEnd: -trailingInset }} colorScheme='dark' ignoreSafeArea='all'>
                <List
                    modifiers={[
                        listStyle('plain'),
                        environment('defaultMinListRowHeight', '44'),
                        listRowSpacing(spacing),
                        scrollContentBackground('hidden'),
                    ]}
                >
                    {children}
                </List>
            </Host>
            {Children.map(children, (_, index) => (
                <View pointerEvents='none' style={[styles.separator, { bottom: height - (index + 1) * rowHeight }]} />
            ))}
        </View>
    );
}

export function CounterMembersListRow({ children, username, disabled, onRemove, testID }: CounterMembersListRowProps) {
    const { fontScale } = useWindowDimensions();
    const swipeHeight = getSwipeHeight(fontScale);
    return (
        <SwipeActions
            modifiers={[
                frame({ height: swipeHeight }),
                listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 }),
                listRowBackground(colors.surface),
                listRowSeparator('hidden'),
            ]}
        >
            <RNHostView>
                {cloneElement(children, {
                    style: [
                        children.props.style,
                        { height: swipeHeight, paddingEnd: trailingInset, borderBottomWidth: 0 },
                    ],
                })}
            </RNHostView>
            {onRemove && (
                <SwipeActions.Actions edge='trailing' allowsFullSwipe>
                    {/* Confirmation opens first. A destructive role would animate removal before confirmation. */}
                    <Button
                        label='Remove'
                        onPress={onRemove}
                        modifiers={[
                            tint(colors.dangerButton),
                            disable(disabled),
                            accessibilityLabel(`Remove ${username}`),
                        ]}
                        testID={testID}
                    />
                </SwipeActions.Actions>
            )}
        </SwipeActions>
    );
}

const styles = StyleSheet.create({
    separator: {
        position: 'absolute',
        start: 0,
        end: 0,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
    },
});
