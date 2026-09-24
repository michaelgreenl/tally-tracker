import { addCounterAmount, COUNTER_MAX } from '@tally/core/client';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../../theme/colors';
import { CounterNumber } from './counter-number';

import type { ReactNode } from 'react';

type CounterStepperProps = {
    value: number;
    increment?: number;
    minimum?: number;
    disabled?: boolean;
    label: string;
    testID: string;
    onIncrement: (amount: number) => void;
    onEditValue: () => void;
    children?: ReactNode;
};

export function CounterStepper({
    value,
    increment = 1,
    minimum = -COUNTER_MAX,
    disabled,
    label,
    testID,
    onIncrement,
    onEditValue,
    children,
}: CounterStepperProps) {
    function button(direction: -1 | 1) {
        const next = addCounterAmount(value, direction * increment);
        const unavailable = disabled || !Number.isFinite(next) || next < minimum || next > COUNTER_MAX;
        return (
            <Pressable
                accessibilityLabel={`${direction < 0 ? 'Decrease' : 'Increase'} ${label} by ${increment}`}
                accessibilityRole='button'
                disabled={unavailable}
                onPress={() => onIncrement(direction * increment)}
                style={({ pressed }) => [styles.button, pressed && styles.pressed, unavailable && styles.disabled]}
                testID={`${testID}-${direction < 0 ? 'decrease' : 'increase'}`}
            >
                <Svg aria-hidden width={24} height={24} viewBox='0 0 24 24' fill='none'>
                    <Path
                        d={direction < 0 ? 'M5 12h14' : 'M12 5v14M5 12h14'}
                        stroke={colors.onPrimary}
                        strokeWidth={2}
                        strokeLinecap='round'
                    />
                </Svg>
            </Pressable>
        );
    }

    return (
        <View style={styles.row}>
            {button(-1)}
            {children || (
                <Pressable
                    accessibilityRole='button'
                    accessibilityLabel={`Edit ${label}, currently ${value}`}
                    onPress={onEditValue}
                    disabled={disabled}
                    style={({ pressed }) => [styles.valueButton, pressed && styles.valuePressed]}
                    testID={`${testID}-edit-value`}
                >
                    <CounterNumber value={value} style={counterNumberStyle} testID={`${testID}-count`} />
                </Pressable>
            )}
            {button(1)}
        </View>
    );
}

export const counterNumberStyle = StyleSheet.create({
    number: {
        minWidth: 80,
        flexShrink: 1,
        color: colors.text,
        fontSize: 38,
        fontVariant: ['tabular-nums'],
        fontWeight: '800',
        textAlign: 'center',
    },
}).number;

const styles = StyleSheet.create({
    valueButton: { minHeight: 52, minWidth: 80, flexShrink: 1, justifyContent: 'center', borderRadius: 9 },
    valuePressed: { backgroundColor: colors.input },
    row: {
        flexDirection: 'row',
        alignSelf: 'center',
        maxWidth: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    button: {
        width: 52,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        borderRadius: 26,
    },
    pressed: { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.97 }] },
    disabled: { opacity: 0.4 },
});
