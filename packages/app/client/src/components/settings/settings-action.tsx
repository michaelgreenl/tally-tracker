import { Pressable, StyleSheet, Text } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';

import { colors } from '../../theme/colors';

type Props = Omit<ComponentProps<typeof Pressable>, 'children' | 'style'> & {
    label: string;
    tone?: 'link' | 'text' | 'danger';
    last?: boolean;
    children?: ReactNode;
};

export function SettingsAction({ label, tone = 'link', last = false, children, ...props }: Props) {
    return (
        <Pressable
            accessibilityRole='button'
            {...props}
            style={({ pressed }) => [
                styles.row,
                Boolean(children) && styles.withAccessory,
                last && styles.last,
                pressed && styles.pressed,
            ]}
        >
            <Text style={[styles.label, { color: colors[tone] }]}>{label}</Text>
            {children}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        minHeight: 54,
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    withAccessory: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    label: { fontSize: 15, fontWeight: '700' },
    last: { borderBottomWidth: 0 },
    pressed: { backgroundColor: colors.input },
});
