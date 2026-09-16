import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../colors';
import { TallyLogo } from './tally-logo';

import type { TextProps } from 'react-native';

export function TallyBrand({ style }: Pick<TextProps, 'style'>) {
    const { fontSize = 34 } = StyleSheet.flatten(style) ?? {};

    return (
        <View style={[styles.brand, { gap: (fontSize * 8) / 34 }]} testID='tally-brand'>
            <TallyLogo color={colors.text} size={(fontSize * 34) / 28} />
            <Text
                accessibilityRole='header'
                aria-level={1}
                style={[styles.title, { fontSize }, style]}
                testID='tally-title'
            >
                Tally
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    brand: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        color: colors.text,
        fontWeight: '700',
    },
});
