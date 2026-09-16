import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutDown, FadeOutUp, useReducedMotion } from 'react-native-reanimated';

import type { TextStyle } from 'react-native';

export type CounterNumberProps = { value: number; label?: string; testID?: string; style: TextStyle };

export function CounterNumber({ value, label, testID, style }: CounterNumberProps) {
    const [transition, setTransition] = useState({ value, direction: 0 });
    const reduceMotion = useReducedMotion();
    if (value !== transition.value) setTransition({ value, direction: value < transition.value ? -1 : 1 });
    const decreasing = transition.direction < 0;
    const changed = transition.direction !== 0;

    return (
        <View
            accessible={Boolean(label)}
            accessibilityLabel={label}
            style={{ minWidth: 80, flexShrink: 1, overflow: 'hidden' }}
            testID={testID}
        >
            <Animated.Text
                key={value}
                entering={!reduceMotion && changed ? (decreasing ? FadeInUp : FadeInDown).duration(180) : undefined}
                exiting={!reduceMotion ? (decreasing ? FadeOutDown : FadeOutUp).duration(180) : undefined}
                style={style}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.3}
            >
                {value}
            </Animated.Text>
        </View>
    );
}
