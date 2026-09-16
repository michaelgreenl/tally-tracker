import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../colors';

export type ToolbarButtonProps = {
    label: string;
    icon?: 'close' | 'check';
    role?: 'cancel';
    disabled?: boolean;
    onPress: () => void;
    testID: string;
};

export function ToolbarButton({ label, icon, role, disabled, onPress, testID }: ToolbarButtonProps) {
    return (
        <Pressable
            accessibilityRole='button'
            accessibilityLabel={label}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.button,
                role === 'cancel' && styles.cancel,
                icon && styles.iconButton,
                (pressed || disabled) && styles.dimmed,
            ]}
            testID={testID}
        >
            {icon ? (
                <View style={[styles.circle, icon === 'close' && styles.cancel]}>
                    <Svg aria-hidden width={22} height={22} viewBox='0 0 24 24' fill='none'>
                        <Path
                            d={icon === 'close' ? 'M6 6l12 12M6 18L18 6' : 'M5 12l4 4L19 6'}
                            stroke={colors.text}
                            strokeWidth={2.3}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    </Svg>
                </View>
            ) : (
                <Text style={styles.label}>{label}</Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        minWidth: 48,
        minHeight: 48,
        paddingHorizontal: 13,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    iconButton: { paddingHorizontal: 0, backgroundColor: 'transparent' },
    circle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    cancel: { backgroundColor: colors.input },
    dimmed: { opacity: 0.5 },
    label: { color: colors.onPrimary, fontSize: 17, fontWeight: '600' },
});
