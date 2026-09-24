import { Host, Text } from '@expo/ui/swift-ui';
import {
    accessibilityLabel,
    animation,
    Animation,
    contentTransition,
    font,
    foregroundStyle,
    lineLimit,
    minimumScaleFactor,
    monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { StyleSheet, Text as NativeText, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { CounterNumberProps } from './counter-number';

export function CounterNumber({ value, label, testID, style }: CounterNumberProps) {
    const [transition, setTransition] = useState({ value, decreasing: false });
    const reduceMotion = useReducedMotion();
    const { fontScale } = useWindowDimensions();
    if (value !== transition.value) setTransition({ value, decreasing: value < transition.value });

    return (
        <View style={{ minWidth: 80, flexShrink: 1 }}>
            {/* Let React Native size the number; the SwiftUI animation fills those bounds without stretching. */}
            <NativeText
                aria-hidden
                style={[style, { opacity: 0 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.3}
            >
                {value}
            </NativeText>
            <Host style={StyleSheet.absoluteFill} colorScheme='dark' ignoreSafeArea='all'>
                <Text
                    testID={testID}
                    modifiers={[
                        font({ size: (style.fontSize ?? 38) * fontScale, weight: 'heavy' }),
                        foregroundStyle(style.color ?? '#ffffff'),
                        monospacedDigit(),
                        lineLimit(1),
                        minimumScaleFactor(0.3),
                        accessibilityLabel(label ?? String(value)),
                        contentTransition(reduceMotion ? 'opacity' : 'numericText', {
                            countsDown: transition.decreasing,
                        }),
                        animation(Animation.easeOut({ duration: reduceMotion ? 0.1 : 0.24 }), value),
                    ]}
                >
                    {String(value)}
                </Text>
            </Host>
        </View>
    );
}
