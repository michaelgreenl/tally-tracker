import { PASSWORD_REQUIREMENTS, passwordSchema } from '@tally/core/client';
import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Fragment, forwardRef, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useSession } from '../session';
import checkboxStyles, { unstable_styles as webStyles } from './auth-screen.module.css';
import { TallyLogo } from './tally-logo';

import type { TextInputProps } from 'react-native';

type AuthScreenProps = {
    mode: 'login' | 'register';
};

const primaryColor = '#0f7899';

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

const legalLinks = [
    { label: 'Privacy', document: 'privacy' },
    { label: 'Terms', document: 'terms' },
    { label: 'Support', document: 'support' },
] as const;

export function AuthScreen({ mode }: AuthScreenProps) {
    const router = useRouter();
    const session = useSession();
    const isLogin = mode === 'login';
    const passwordInputRef = useRef<TextInput>(null);
    const confirmPasswordInputRef = useRef<TextInput>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    async function submit() {
        if (!email.includes('@')) {
            setErrorMessage('Please enter a valid email address.');
            return;
        }

        if (!isLogin) {
            const result = passwordSchema.safeParse(password);
            if (!result.success) {
                setErrorMessage(result.error.issues[0].message);
                return;
            }
        }

        if (!isLogin && password !== confirmPassword) {
            setErrorMessage("Passwords don't match.");
            return;
        }

        setLoading(true);
        setErrorMessage('');

        const result = isLogin
            ? await session.login({ email, password, rememberMe })
            : await session.register({ email, password });

        setLoading(false);
        if (!result.success) {
            setErrorMessage(result.message);
            return;
        }

        router.replace(isLogin ? '/home' : { pathname: '/verify-email', params: { email } });
    }

    return (
        <>
            <Head>
                <title>{`Tally | ${isLogin ? 'Login' : 'Register'}`}</title>
            </Head>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.pageHeader} testID='auth-page-header'>
                    <View style={styles.brand} testID='auth-brand'>
                        <TallyLogo color='#f8f9fa' size={40} />
                        <Text accessibilityRole='header' aria-level={1} style={styles.brandTitle} testID='auth-title'>
                            Tally
                        </Text>
                    </View>
                    {isLogin && (
                        <Link href='/home' asChild>
                            <Pressable
                                accessibilityRole='link'
                                hitSlop={8}
                                style={styles.guestLink}
                                testID='continue-as-guest'
                            >
                                {({ pressed }) => (
                                    <>
                                        <Text
                                            style={[
                                                styles.link,
                                                styles.guestLinkText,
                                                Platform.OS === 'web' && webStyles.linkText,
                                                pressed && styles.linkUnderlined,
                                            ]}
                                        >
                                            Continue as guest
                                        </Text>
                                        <Svg
                                            aria-hidden
                                            width={5}
                                            height={8}
                                            viewBox='0 0 5 8'
                                            style={styles.guestChevron}
                                        >
                                            <Path
                                                d='m0.75 0.75 3.5 3.25-3.5 3.25'
                                                fill='none'
                                                stroke='#f8f9fa'
                                                strokeWidth={1.5}
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                            />
                                        </Svg>
                                    </>
                                )}
                            </Pressable>
                        </Link>
                    )}
                </View>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardAvoider}
                >
                    <ScrollView
                        contentContainerStyle={[styles.scrollContent, isLogin && styles.loginScrollContent]}
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        keyboardShouldPersistTaps='handled'
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={[styles.card, isLogin && styles.loginCard]} testID='auth-card'>
                            {!isLogin && (
                                <View style={styles.header}>
                                    <Text accessibilityRole='header' aria-level={2} style={styles.title}>
                                        Create Account
                                    </Text>
                                    <Text style={styles.subtitle}>Get started with Tally</Text>
                                </View>
                            )}

                            <FormField
                                autoCapitalize='none'
                                autoComplete='email'
                                editable={!loading}
                                keyboardType='email-address'
                                label='Email Address'
                                onChangeText={setEmail}
                                onSubmitEditing={() => passwordInputRef.current?.focus()}
                                placeholder='name@example.com'
                                returnKeyType='next'
                                testID='auth-email'
                                textContentType='emailAddress'
                                value={email}
                            />

                            <View style={[styles.field, isLogin && styles.loginPasswordField]}>
                                <Text style={styles.label}>Password</Text>
                                <View
                                    testID='auth-password-field'
                                    style={[
                                        styles.passwordInput,
                                        passwordFocused && styles.inputFocused,
                                        loading && styles.inputDisabled,
                                    ]}
                                >
                                    <TextInput
                                        accessibilityLabel='Password'
                                        autoCapitalize='none'
                                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                                        editable={!loading}
                                        onBlur={() => setPasswordFocused(false)}
                                        onChangeText={setPassword}
                                        onFocus={() => setPasswordFocused(true)}
                                        onSubmitEditing={() => {
                                            if (isLogin) void submit();
                                            else confirmPasswordInputRef.current?.focus();
                                        }}
                                        placeholderTextColor='#8d969e'
                                        ref={passwordInputRef}
                                        returnKeyType={isLogin ? 'done' : 'next'}
                                        secureTextEntry={!showPassword}
                                        style={[styles.passwordTextInput, Platform.OS === 'web' && webStyles.textInput]}
                                        testID='auth-password'
                                        textContentType={isLogin ? 'password' : 'newPassword'}
                                        value={password}
                                    />
                                    <Pressable
                                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                                        accessibilityRole='button'
                                        hitSlop={8}
                                        onPress={() => setShowPassword((visible) => !visible)}
                                        style={({ pressed }) => pressed && styles.linkPressed}
                                    >
                                        <Text style={styles.passwordToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
                                    </Pressable>
                                </View>
                                {!isLogin && <Text style={styles.helpText}>{PASSWORD_REQUIREMENTS}</Text>}
                            </View>

                            {!isLogin && (
                                <FormField
                                    autoCapitalize='none'
                                    autoComplete='new-password'
                                    editable={!loading}
                                    label='Confirm Password'
                                    onChangeText={setConfirmPassword}
                                    onSubmitEditing={() => void submit()}
                                    ref={confirmPasswordInputRef}
                                    returnKeyType='done'
                                    secureTextEntry
                                    testID='auth-confirm-password'
                                    textContentType='newPassword'
                                    value={confirmPassword}
                                />
                            )}

                            {isLogin && (
                                <View style={styles.loginOptions}>
                                    {Platform.OS === 'web' && (
                                        <View style={styles.rememberControl}>
                                            <input
                                                aria-label='Remember me'
                                                checked={rememberMe}
                                                className={checkboxStyles.rememberCheckbox}
                                                data-testid='auth-remember-me'
                                                disabled={loading}
                                                onChange={(event) => setRememberMe(event.target.checked)}
                                                style={{ color: primaryColor }}
                                                type='checkbox'
                                            />
                                            <Text style={styles.rememberLabel} testID='auth-remember-me-label'>
                                                Remember me
                                            </Text>
                                        </View>
                                    )}
                                    <Link href='/forgot-password' asChild>
                                        <Pressable
                                            accessibilityRole='link'
                                            style={styles.forgotPassword}
                                            testID='auth-forgot-password'
                                        >
                                            {({ pressed }) => (
                                                <Text
                                                    style={[
                                                        styles.link,
                                                        styles.loginOptionLink,
                                                        Platform.OS === 'web' && webStyles.linkText,
                                                        pressed && styles.linkUnderlined,
                                                    ]}
                                                >
                                                    Forgot password?
                                                </Text>
                                            )}
                                        </Pressable>
                                    </Link>
                                </View>
                            )}

                            {Boolean(errorMessage) && (
                                <View
                                    accessibilityLiveRegion='polite'
                                    accessibilityRole='alert'
                                    style={styles.errorBox}
                                    testID='auth-error'
                                >
                                    <Text style={styles.errorText}>{errorMessage}</Text>
                                </View>
                            )}

                            <Pressable
                                accessibilityRole='button'
                                disabled={loading}
                                onPress={() => void submit()}
                                style={({ pressed }) => [
                                    styles.primaryButton,
                                    pressed && styles.primaryButtonPressed,
                                    loading && styles.primaryButtonDisabled,
                                ]}
                                testID='auth-submit'
                            >
                                {loading ? (
                                    <ActivityIndicator color='#ffffff' />
                                ) : (
                                    <Text style={styles.primaryButtonText}>{isLogin ? 'Login' : 'Register'}</Text>
                                )}
                            </Pressable>

                            <View style={styles.footer}>
                                <View style={styles.signupRow}>
                                    <Text style={styles.rememberLabel}>
                                        {isLogin ? "Don't have an account?" : 'Already have an account?'}
                                    </Text>
                                    <Link href={isLogin ? '/register' : '/login'} asChild>
                                        <Pressable accessibilityRole='link' hitSlop={8} testID='auth-switch-mode'>
                                            {({ pressed }) => (
                                                <Text
                                                    style={[
                                                        styles.link,
                                                        Platform.OS === 'web' && webStyles.linkText,
                                                        pressed && styles.linkUnderlined,
                                                    ]}
                                                >
                                                    {isLogin ? 'Sign up' : 'Sign in'}
                                                </Text>
                                            )}
                                        </Pressable>
                                    </Link>
                                </View>
                                <View
                                    accessibilityLabel='Legal links'
                                    accessibilityRole='summary'
                                    style={styles.legalLinks}
                                >
                                    {legalLinks.map((link, index) => (
                                        <Fragment key={link.document}>
                                            {index > 0 && (
                                                <Text aria-hidden style={styles.legalSeparator}>
                                                    •
                                                </Text>
                                            )}
                                            <Link
                                                href={{
                                                    pathname: '/legal/[document]',
                                                    params: { document: link.document },
                                                }}
                                                asChild
                                            >
                                                <Pressable accessibilityRole='link' hitSlop={8}>
                                                    {({ pressed }) => (
                                                        <Text
                                                            style={[
                                                                styles.legalLink,
                                                                Platform.OS === 'web' && webStyles.linkText,
                                                                pressed && styles.linkUnderlined,
                                                            ]}
                                                        >
                                                            {link.label}
                                                        </Text>
                                                    )}
                                                </Pressable>
                                            </Link>
                                        </Fragment>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#495057',
    },
    pageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingHorizontal: 32,
        paddingTop: 24,
        paddingBottom: 12,
    },
    brand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    brandTitle: {
        color: '#f8f9fa',
        fontSize: 34,
        fontWeight: '700',
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
    loginScrollContent: {
        justifyContent: 'center',
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
    loginCard: {
        padding: 24,
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
    guestLink: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        gap: 4,
    },
    guestLinkText: {
        color: '#f8f9fa',
        flexShrink: 1,
        fontSize: 14,
        textAlign: 'right',
    },
    guestChevron: {
        // Align with the label's visible glyphs, below the center of its line box.
        transform: [{ translateY: 1 }],
    },
    subtitle: {
        color: '#575e64',
        fontSize: 15,
    },
    field: {
        marginBottom: 18,
    },
    loginPasswordField: {
        marginBottom: 4,
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
    inputDisabled: {
        opacity: 0.65,
    },
    passwordInput: {
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#ced4da',
        borderRadius: 10,
    },
    passwordTextInput: {
        minWidth: 0,
        flex: 1,
        paddingVertical: 12,
        color: '#212529',
        fontSize: 16,
    },
    passwordToggle: {
        paddingLeft: 12,
        color: primaryColor,
        fontSize: 14,
        fontWeight: '700',
    },
    helpText: {
        marginTop: 7,
        color: '#575e64',
        fontSize: 13,
    },
    loginOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        columnGap: 12,
        marginBottom: 18,
    },
    rememberControl: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
    },
    rememberLabel: {
        color: '#343a40',
        fontSize: 14,
    },
    forgotPassword: {
        minHeight: 44,
        justifyContent: 'center',
        marginLeft: 'auto',
    },
    loginOptionLink: {
        fontSize: 14,
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
    signupRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
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
    legalLinks: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    legalSeparator: {
        color: primaryColor,
        fontSize: 10,
    },
    legalLink: {
        color: primaryColor,
        fontSize: 13,
    },
});

export { styles as authScreenStyles };
