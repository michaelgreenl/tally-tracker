import { Platform, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../colors';
import webStyles from './checkbox.module.css';

import type { CSSProperties } from 'react';

type CheckboxProps = {
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
    testID?: string;
};

export function Checkbox({ label, value, onValueChange, disabled, testID }: CheckboxProps) {
    if (Platform.OS === 'web') {
        return (
            <input
                aria-label={label}
                checked={value}
                className={webStyles.checkbox}
                data-testid={testID}
                disabled={disabled}
                onChange={(event) => onValueChange(event.target.checked)}
                style={
                    {
                        color: colors.primary,
                        '--field-background': colors.input,
                        '--field-border': colors.border,
                        '--field-focus': colors.link,
                    } as CSSProperties
                }
                type='checkbox'
            />
        );
    }

    return (
        <Pressable
            accessibilityLabel={label}
            accessibilityRole='checkbox'
            accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
            disabled={disabled}
            hitSlop={13}
            onPress={() => onValueChange(!value)}
            style={({ pressed }) => [styles.box, value && styles.checked, (pressed || disabled) && styles.dimmed]}
            testID={testID}
        >
            {value && (
                <Svg aria-hidden width={14} height={14} viewBox='0 0 16 16'>
                    <Path
                        d='m3 8 3 3 7-7'
                        fill='none'
                        stroke={colors.onPrimary}
                        strokeWidth={2}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                </Svg>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    box: {
        width: 18,
        height: 18,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderRadius: 4,
        borderColor: colors.border,
        backgroundColor: colors.input,
    },
    checked: {
        borderColor: colors.primary,
        backgroundColor: colors.primary,
    },
    dimmed: {
        opacity: 0.65,
    },
});
