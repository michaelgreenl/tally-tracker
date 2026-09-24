import { Platform, StyleSheet, Text } from 'react-native';
import type { TextProps } from 'react-native';

export function MessageText({ style, ...props }: TextProps) {
    return (
        <Text {...props} textBreakStrategy='balanced' lineBreakStrategyIOS='push-out' style={[styles.text, style]} />
    );
}

const styles = StyleSheet.create({
    text: { flexShrink: 1, ...Platform.select({ web: { textWrap: 'balance' } }) },
});
