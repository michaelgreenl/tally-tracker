import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../colors';

import type { PressableProps } from 'react-native';

export function BackButton({ onPress, testID }: Pick<PressableProps, 'onPress' | 'testID'>) {
    return (
        <Pressable
            accessibilityLabel='Back'
            accessibilityRole='button'
            hitSlop={{ left: 13, right: 13 }}
            onPress={onPress}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            testID={testID}
        >
            <Svg aria-hidden width={24} height={24} viewBox='0 0 24 24'>
                <Path
                    d='M19 12H5m7-7-7 7 7 7'
                    fill='none'
                    stroke={colors.text}
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />
            </Svg>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        width: 18,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 22,
    },
    pressed: {
        opacity: 0.55,
    },
});
