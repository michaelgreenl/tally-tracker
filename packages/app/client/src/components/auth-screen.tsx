import { emailSchema, loginPasswordSchema, PASSWORD_REQUIREMENTS, passwordSchema } from '@tally/core/client';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { unstable_styles as webStyles } from './auth-form.module.css';
import { AuthLink, FormField, styles as formStyles } from './auth-form';
import { BackButton } from './back-button';
import { Checkbox } from './checkbox';
import { TallyBrand } from './tally-brand';
import { GoogleSignIn } from './google-sign-in';
import { MessageText } from './message-text';

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
    const params = useLocalSearchParams<{ email?: string | string[]; inviteCode?: string | string[] }>();
    const inviteCode = typeof params.inviteCode === 'string' ? params.inviteCode : undefined;
    const emailParameter = typeof params.email === 'string' ? params.email : params.email?.[0] || '';
    const session = useSession();
    const insets = useSafeAreaInsets();
    const [headerHeight, setHeaderHeight] = useState(0);
    const isLogin = mode === 'login';
    const passwordInputRef = useRef<TextInput>(null);
    const confirmPasswordInputRef = useRef<TextInput>(null);
    const [email, setEmail] = useState(emailParameter);
    const [previousEmailParameter, setPreviousEmailParameter] = useState(emailParameter);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const loading = passwordLoading || googleLoading;
    const [errorMessage, setErrorMessage] = useState('');

    if (emailParameter !== previousEmailParameter) {
        setPreviousEmailParameter(emailParameter);
        setEmail(emailParameter);
        setPassword('');
        setConfirmPassword('');
        setErrorMessage('');
    }

    async function submit() {
        if (loading) return;
        const emailResult = emailSchema.safeParse(email);
        if (!emailResult.success) {
            setErrorMessage(emailResult.error.issues[0].message);
            return;
        }

        const passwordResult = (isLogin ? loginPasswordSchema : passwordSchema).safeParse(password);
        if (!passwordResult.success) {
            setErrorMessage(passwordResult.error.issues[0].message);
            return;
        }

        if (!isLogin && password !== confirmPassword) {
            setErrorMessage("Passwords don't match.");
            return;
        }

        setPasswordLoading(true);
        setErrorMessage('');

        const result = isLogin
            ? await session.login({ email: emailResult.data, password, rememberMe })
            : await session.register({ email: emailResult.data, password });

        setPasswordLoading(false);
        if (!result.success) {
            setErrorMessage(result.message);
            return;
        }

        if (isLogin) {
            router.replace(inviteCode ? { pathname: '/join', params: { code: inviteCode } } : '/home');
        } else {
            router.replace({ pathname: '/verify-email', params: { email, inviteCode } });
        }
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
                    <BackButton
                        onPress={() =>
                            router.canGoBack()
                                ? router.back()
                                : router.replace(
                                      isLogin ? '/home' : { pathname: '/login', params: { email, inviteCode } },
                                  )
                        }
                        testID={`auth-${mode}-back`}
                    />
                    <TallyBrand style={styles.brand} />
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
                        keyboardDismissMode={Platform.select({
                            ios: 'interactive',
                            android: 'on-drag',
                            default: 'none',
                        })}
                        keyboardShouldPersistTaps='handled'
                        showsVerticalScrollIndicator={false}
                        testID='auth-scroll'
                    >
                        <View style={[styles.card, isLogin && styles.loginCard]} testID='auth-card'>
                            {isLogin && (
                                <AuthLink
                                    href='/home'
                                    hitSlop={8}
                                    style={styles.guestLink}
                                    textStyle={styles.guestLinkText}
                                    testID='continue-as-guest'
                                    icon={
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
                                            <Checkbox
                                                label='Remember me'
                                                value={rememberMe}
                                                testID='auth-remember-me'
                                                disabled={loading}
                                                onValueChange={setRememberMe}
                                            />
                                            <Text style={styles.rememberLabel} testID='auth-remember-me-label'>
                                                Remember me
                                            </Text>
                                        </View>
                                    )}
                                    <AuthLink
                                        href={{ pathname: '/forgot-password', params: { email, inviteCode } }}
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
                                    <MessageText style={styles.errorText} testID='auth-error-message'>
                                        {errorMessage}
                                    </MessageText>
                                </View>
                            )}

                            <Pressable
                                accessibilityRole='button'
                                accessibilityState={{ disabled: loading, busy: passwordLoading }}
                                disabled={loading}
                                onPress={() => void submit()}
                                style={({ pressed }) => [
                                    styles.primaryButton,
                                    pressed && styles.primaryButtonPressed,
                                    loading && styles.primaryButtonDisabled,
                                ]}
                                testID='auth-submit'
                            >
                                {passwordLoading ? (
                                    <ActivityIndicator color={colors.onPrimary} testID='auth-submit-loading' />
                                ) : (
                                    <Text style={styles.primaryButtonText}>{isLogin ? 'Login' : 'Register'}</Text>
                                )}
                            </Pressable>

                            <GoogleSignIn
                                disabled={loading}
                                busy={googleLoading}
                                rememberMe={rememberMe}
                                onBusyChange={setGoogleLoading}
                                onError={setErrorMessage}
                                onSuccess={() =>
                                    router.replace(
                                        inviteCode ? { pathname: '/join', params: { code: inviteCode } } : '/home',
                                    )
                                }
                            />

                            <View style={styles.footer}>
                                <View style={styles.signupRow}>
                                    <Text style={styles.rememberLabel}>
                                        {isLogin ? "Don't have an account?" : 'Already have an account?'}
                                    </Text>
                                    <AuthLink
                                        href={{
                                            pathname: isLogin ? '/register' : '/login',
                                            params: { email, inviteCode },
                                        }}
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
        paddingTop: 12,
        paddingBottom: 12,
    },
    scrollContent: {
        ...formStyles.scrollContent,
        justifyContent: 'center',
    },
    brand: {
        fontSize: 28,
        lineHeight: 34,
    },
    loginCard: {
        padding: 24,
    },
    guestLink: {
        alignSelf: 'flex-end',
        minHeight: 20,
        marginBottom: 12,
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
