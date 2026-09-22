import { Link } from 'expo-router';
import { forwardRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../colors';
import { unstable_styles as webStyles } from './auth-form.module.css';

import type { LinkProps } from 'expo-router';
import type { PressableProps, StyleProp, TextInputProps, TextProps, TextStyle } from 'react-native';

export const FormField = forwardRef<TextInput, TextInputProps & { help?: string; label: string }>(function FormField(
    { help, label, ...inputProps },
    ref,
) {
    const [focused, setFocused] = useState(false);

    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                {...inputProps}
                accessibilityLabel={label}
                onBlur={(event) => {
                    setFocused(false);
                    inputProps.onBlur?.(event);
                }}
                onFocus={(event) => {
                    setFocused(true);
                    inputProps.onFocus?.(event);
                }}
                placeholderTextColor={colors.muted}
                ref={ref}
                style={[
                    styles.input,
                    focused && styles.inputFocused,
                    Platform.OS === 'web' && webStyles.textInput,
                    inputProps.style,
                ]}
            />
            {help && <Text style={styles.helpText}>{help}</Text>}
        </View>
    );
});

type AuthLinkProps = Pick<PressableProps, 'accessibilityLabel' | 'hitSlop' | 'style' | 'testID'> &
    Pick<TextProps, 'allowFontScaling'> & {
        href: LinkProps['href'];
        children: string;
        textStyle?: StyleProp<TextStyle>;
    };

export function AuthLink({ href, children, textStyle, allowFontScaling, ...props }: AuthLinkProps) {
    return (
        <Link href={href} asChild>
            <Pressable accessibilityRole='link' {...props}>
                {({ pressed }) => (
                    <Text
                        allowFontScaling={allowFontScaling}
                        style={[
                            styles.link,
                            textStyle,
                            Platform.OS === 'web' && webStyles.linkText,
                            pressed && styles.linkUnderlined,
                        ]}
                    >
                        {children}
                    </Text>
                )}
            </Pressable>
        </Link>
    );
}

export const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardAvoider: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 32,
    },
    card: {
        width: '100%',
        maxWidth: 430,
        padding: 28,
        backgroundColor: colors.surface,
        borderRadius: 16,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
        elevation: 5,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        marginBottom: 8,
        color: colors.text,
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        color: colors.muted,
        fontSize: 15,
    },
    field: {
        marginBottom: 18,
    },
    label: {
        marginBottom: 7,
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    input: {
        minHeight: 50,
        paddingHorizontal: 14,
        color: colors.text,
        fontSize: 16,
        backgroundColor: colors.input,
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: 10,
    },
    inputFocused: {
        borderColor: colors.link,
    },
    helpText: {
        marginTop: 7,
        color: colors.muted,
        fontSize: 13,
    },
    errorBox: {
        padding: 12,
        marginBottom: 18,
        backgroundColor: colors.dangerSurface,
        borderRadius: 8,
    },
    errorText: {
        color: colors.danger,
        fontSize: 14,
        textAlign: 'center',
    },
    statusBox: {
        padding: 12,
        marginBottom: 18,
        backgroundColor: colors.infoSurface,
        borderRadius: 8,
    },
    statusText: {
        color: colors.link,
        fontSize: 14,
        textAlign: 'center',
    },
    primaryButton: {
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        borderRadius: 10,
    },
    primaryButtonPressed: {
        opacity: 0.8,
    },
    primaryButtonDisabled: {
        opacity: 0.7,
    },
    primaryButtonText: {
        color: colors.onPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    footer: {
        alignItems: 'center',
        gap: 16,
        marginTop: 22,
    },
    secondaryActions: {
        alignItems: 'center',
        gap: 18,
        marginTop: 22,
    },
    link: {
        color: colors.link,
        fontSize: 15,
        fontWeight: '700',
    },
    linkPressed: {
        opacity: 0.55,
    },
    linkUnderlined: {
        textDecorationLine: 'underline',
    },
});
