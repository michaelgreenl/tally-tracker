import { PASSWORD_REQUIREMENTS, passwordSchema } from '@tally/core/client';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Fragment, useRef, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../colors';
import { useSession } from '../session';
import checkboxStyles, { unstable_styles as webStyles } from './auth-form.module.css';
import { AuthLink, FormField, styles as formStyles } from './auth-form';
import { TallyBrand } from './tally-brand';

import type { CSSProperties } from 'react';

type AuthScreenProps = {
    mode: 'login' | 'register';
};

const legalLinks = [
    { label: 'Privacy', document: 'privacy' },
    { label: 'Terms', document: 'terms' },
    { label: 'Support', document: 'support' },
] as const;

export function AuthScreen({ mode }: AuthScreenProps) {
    const router = useRouter();
    const session = useSession();
    const insets = useSafeAreaInsets();
    const [headerHeight, setHeaderHeight] = useState(0);
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
                <View
                    onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
                    style={styles.pageHeader}
                    testID='auth-page-header'
                >
                    <TallyBrand />
                    {isLogin && (
                        <AuthLink
                            href='/home'
                            hitSlop={8}
                            style={styles.guestLink}
                            textStyle={styles.guestLinkText}
                            testID='continue-as-guest'
                            icon={
                                <Svg aria-hidden width={5} height={8} viewBox='0 0 5 8' style={styles.guestChevron}>
                                    <Path
                                        d='m0.75 0.75 3.5 3.25-3.5 3.25'
                                        fill='none'
                                        stroke={colors.text}
                                        strokeWidth={1.5}
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    />
                                </Svg>
                            }
                        >
                            Continue as guest
                        </AuthLink>
                    )}
                </View>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardAvoider}
                >
                    <ScrollView
                        contentContainerStyle={[
                            styles.scrollContent,
                            // Balance the header and safe areas to center in the viewport, not below the header.
                            {
                                paddingBottom:
                                    formStyles.scrollContent.paddingVertical +
                                    headerHeight +
                                    insets.top -
                                    insets.bottom,
                            },
                        ]}
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        keyboardShouldPersistTaps='handled'
                        showsVerticalScrollIndicator={false}
                        testID='auth-scroll'
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
                                        placeholderTextColor={colors.muted}
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
                                            <Text style={styles.rememberLabel} testID='auth-remember-me-label'>
                                                Remember me
                                            </Text>
                                        </View>
                                    )}
                                    <AuthLink
                                        href='/forgot-password'
                                        style={styles.forgotPassword}
                                        textStyle={styles.loginOptionLink}
                                        testID='auth-forgot-password'
                                    >
                                        Forgot password?
                                    </AuthLink>
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
                                    <ActivityIndicator color={colors.onPrimary} />
                                ) : (
                                    <Text style={styles.primaryButtonText}>{isLogin ? 'Login' : 'Register'}</Text>
                                )}
                            </Pressable>

                            <View style={styles.footer}>
                                <View style={styles.signupRow}>
                                    <Text style={styles.rememberLabel}>
                                        {isLogin ? "Don't have an account?" : 'Already have an account?'}
                                    </Text>
                                    <AuthLink
                                        href={isLogin ? '/register' : '/login'}
                                        hitSlop={8}
                                        testID='auth-switch-mode'
                                    >
                                        {isLogin ? 'Sign up' : 'Sign in'}
                                    </AuthLink>
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
                                            <AuthLink
                                                href={{
                                                    pathname: '/legal/[document]',
                                                    params: { document: link.document },
                                                }}
                                                hitSlop={8}
                                                textStyle={styles.legalLink}
                                            >
                                                {link.label}
                                            </AuthLink>
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
    ...formStyles,
    pageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingHorizontal: 32,
        paddingTop: 24,
        paddingBottom: 12,
    },
    scrollContent: {
        ...formStyles.scrollContent,
        justifyContent: 'center',
    },
    loginCard: {
        padding: 24,
    },
    guestLink: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        gap: 4,
    },
    guestLinkText: {
        color: colors.text,
        flexShrink: 1,
        fontSize: 14,
        textAlign: 'right',
    },
    guestChevron: {
        // Align with the label's visible glyphs, below the center of its line box.
        transform: [{ translateY: 1 }],
    },
    loginPasswordField: {
        marginBottom: 4,
    },
    inputDisabled: {
        opacity: 0.65,
    },
    passwordInput: {
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        backgroundColor: colors.input,
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: 10,
    },
    passwordTextInput: {
        minWidth: 0,
        flex: 1,
        paddingVertical: 12,
        color: colors.text,
        fontSize: 16,
    },
    passwordToggle: {
        paddingLeft: 12,
        color: colors.link,
        fontSize: 14,
        fontWeight: '700',
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
        color: colors.text,
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
    signupRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
    },
    legalLinks: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    legalSeparator: {
        color: colors.link,
        fontSize: 10,
    },
    legalLink: {
        fontSize: 13,
        fontWeight: '400',
    },
});
