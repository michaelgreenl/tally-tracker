import { type ReactElement, type ReactNode, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { hapticFeedback } from '../../infra/feedback/haptics';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

export type CounterMembersListProps = { children: ReactNode; height: number };
export type CounterMembersListRowProps = {
    children: ReactElement<ViewProps>;
    username: string;
    disabled: boolean;
    onRemove?: () => void;
    height: number;
    testID: string;
};

export function getCounterMemberRowHeight(fontScale: number) {
    return Math.max(64, Math.ceil(24 * fontScale) + 32);
}

export function CounterMembersList({ children }: CounterMembersListProps) {
    return <GestureHandlerRootView style={{ flex: 0 }}>{children}</GestureHandlerRootView>;
}

export function CounterMembersListRow(props: CounterMembersListRowProps) {
    return props.onRemove ? <RemovableParticipant {...props} /> : props.children;
}

function RemovableParticipant({ children, username, disabled, onRemove, testID }: CounterMembersListRowProps) {
    const swipeable = useRef<SwipeableMethods>(null);
    const rowWidth = useRef(0);
    const [open, setOpen] = useState(false);
    const confirmRemoval = () => {
        if (disabled) return;
        swipeable.current?.close();
        onRemove?.();
    };
    const fullSwipe = usePanGesture({
        enabled: !disabled,
        runOnJS: true,
        activeOffsetX: -10,
        failOffsetY: [-10, 10],
        onDeactivate: ({ canceled, translationX }) => {
            if (!canceled && rowWidth.current > 0 && translationX < -rowWidth.current * 0.7) confirmRemoval();
        },
    });
    return (
        <GestureDetector gesture={fullSwipe} touchAction='pan-y'>
            <View
                collapsable={false}
                onLayout={({ nativeEvent }) => {
                    rowWidth.current = nativeEvent.layout.width;
                }}
            >
                <Swipeable
                    ref={swipeable}
                    enabled={!disabled}
                    simultaneousWith={fullSwipe}
                    overshootLeft={false}
                    overshootRight
                    enableTrackpadTwoFingerGesture
                    onSwipeableWillOpen={() => {
                        setOpen(true);
                        hapticFeedback();
                    }}
                    onSwipeableClose={() => setOpen(false)}
                    childrenContainerStyle={styles.rowSurface}
                    renderRightActions={() => (
                        <Pressable
                            accessibilityRole='button'
                            accessibilityLabel={`Remove ${username}`}
                            accessibilityElementsHidden={Platform.OS !== 'web' && !open}
                            importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
                            disabled={disabled}
                            onFocus={() => swipeable.current?.openRight()}
                            onPress={confirmRemoval}
                            style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                            testID={testID}
                        >
                            <Text style={styles.removeText}>Remove</Text>
                        </Pressable>
                    )}
                >
                    <View
                        accessible
                        accessibilityActions={disabled ? [] : [{ name: 'remove', label: 'Remove participant' }]}
                        onAccessibilityAction={({ nativeEvent }) => {
                            if (nativeEvent.actionName === 'remove') confirmRemoval();
                        }}
                    >
                        {children}
                    </View>
                </Swipeable>
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    rowSurface: { backgroundColor: colors.surface },
    removeButton: {
        backgroundColor: colors.dangerButton,
        borderRadius: 999,
        minWidth: 88,
        minHeight: 48,
        marginHorizontal: 8,
        marginVertical: 8,
        paddingHorizontal: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeText: { color: colors.onPrimary, fontFamily: fonts.display, fontSize: 16, fontWeight: '600' },
    pressed: { opacity: 0.7 },
});
