import { StyleSheet, Text, View } from 'react-native';

import { TallyLogo } from './tally-logo';

import type { TextProps } from 'react-native';

export function TallyBrand({ style }: Pick<TextProps, 'style'>) {
    const fontSize = StyleSheet.flatten(style)?.fontSize ?? 34;

    return (
        <View style={[styles.brand, { gap: (fontSize * 8) / 34 }]} testID='tally-brand'>
            <TallyLogo color='#f8f9fa' size={(fontSize * 40) / 34} />
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
        color: '#f8f9fa',
        fontWeight: '700',
    },
});
