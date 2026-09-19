import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../colors';
import { MessageText } from './message-text';

const entering = FadeInDown.duration(200).reduceMotion(ReduceMotion.System);
const exiting = FadeOutDown.duration(150).reduceMotion(ReduceMotion.System);

export function Snackbar({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (message && Platform.OS === 'ios') {
            AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
        }
    }, [message]);

    return (
        <View pointerEvents='box-none' style={[styles.container, { bottom: insets.bottom + 16 }]}>
            {Boolean(message) && (
                <Animated.View entering={entering} exiting={exiting} style={styles.banner} testID='snackbar'>
                    <MessageText accessibilityRole='alert' accessibilityLiveRegion='polite' style={styles.message}>
                        {message}
                    </MessageText>
                    <Pressable
                        accessibilityLabel='Dismiss message'
                        accessibilityRole='button'
                        onPress={onDismiss}
                        style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                        testID='snackbar-dismiss'
                    >
                        <Svg aria-hidden width={18} height={18} viewBox='0 0 24 24'>
                            <Path d='m6 6 12 12M18 6 6 18' stroke={colors.text} strokeWidth={2} strokeLinecap='round' />
                        </Svg>
                    </Pressable>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    banner: {
        width: '100%',
        maxWidth: 640,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
    },
    message: {
        flex: 1,
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    closeButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    pressed: {
        backgroundColor: colors.input,
    },
});
