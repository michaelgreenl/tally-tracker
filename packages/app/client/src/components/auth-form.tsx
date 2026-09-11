import { Link } from 'expo-router';
import { forwardRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { unstable_styles as webStyles } from './auth-form.module.css';

import type { LinkProps } from 'expo-router';
import type { ReactNode } from 'react';
import type { PressableProps, StyleProp, TextInputProps, TextStyle } from 'react-native';

export const primaryColor = '#0f7899';

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
                placeholderTextColor='#8d969e'
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

type AuthLinkProps = Pick<PressableProps, 'hitSlop' | 'style' | 'testID'> & {
    href: LinkProps['href'];
    children: string;
    textStyle?: StyleProp<TextStyle>;
    icon?: ReactNode;
};

export function AuthLink({ href, children, textStyle, icon, ...props }: AuthLinkProps) {
    return (
        <Link href={href} asChild>
            <Pressable accessibilityRole='link' {...props}>
                {({ pressed }) => (
                    <>
                        <Text
                            style={[
                                styles.link,
                                textStyle,
                                Platform.OS === 'web' && webStyles.linkText,
                                pressed && styles.linkUnderlined,
                            ]}
                        >
                            {children}
                        </Text>
                        {icon}
                    </>
                )}
            </Pressable>
        </Link>
    );
}

export const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#495057',
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
        backgroundColor: '#f8f9fa',
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
        color: '#343a40',
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        color: '#575e64',
        fontSize: 15,
    },
    field: {
        marginBottom: 18,
    },
    label: {
        marginBottom: 7,
        color: '#343a40',
        fontSize: 14,
        fontWeight: '600',
    },
    input: {
        minHeight: 50,
        paddingHorizontal: 14,
        color: '#212529',
        fontSize: 16,
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#ced4da',
        borderRadius: 10,
    },
    inputFocused: {
        borderColor: primaryColor,
    },
    helpText: {
        marginTop: 7,
        color: '#575e64',
        fontSize: 13,
    },
    errorBox: {
        padding: 12,
        marginBottom: 18,
        backgroundColor: '#fde8e7',
        borderRadius: 8,
    },
    errorText: {
        color: '#b42318',
        fontSize: 14,
        textAlign: 'center',
    },
    statusBox: {
        padding: 12,
        marginBottom: 18,
        backgroundColor: '#e5f6fb',
        borderRadius: 8,
    },
    statusText: {
        color: '#14566b',
        fontSize: 14,
        textAlign: 'center',
    },
    primaryButton: {
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primaryColor,
        borderRadius: 10,
    },
    primaryButtonPressed: {
        opacity: 0.8,
    },
    primaryButtonDisabled: {
        opacity: 0.7,
    },
    primaryButtonText: {
        color: '#ffffff',
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
        color: primaryColor,
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
