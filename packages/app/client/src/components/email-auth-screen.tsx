import { PASSWORD_REQUIREMENTS, passwordSchema } from '@tally/core/client';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../colors';
import { getErrorMessage } from '../api';
import { AuthService } from '../services/auth.service';
import { useSession } from '../session';
import { FormField, styles } from './auth-form';

type EmailAuthScreenProps = {
    mode: 'verify' | 'reset';
};

type Step = 'email' | 'code' | 'password' | 'complete';

const getEmailParameter = (email: string | string[] | undefined) =>
    typeof email === 'string' ? email : email?.[0] || '';

export function EmailAuthScreen({ mode }: EmailAuthScreenProps) {
    const router = useRouter();
    const params = useLocalSearchParams<{
        email?: string | string[];
        inviteCode?: string | string[];
        returnTo?: string;
        plan?: string;
    }>();
    const session = useSession();
    const inviteCode = typeof params.inviteCode === 'string' ? params.inviteCode : undefined;
    const isVerification = mode === 'verify';
    const resumeSession = isVerification && session.isAuthenticated;
    const returnTo =
        params.returnTo === '/upgrade' ? { pathname: '/upgrade' as const, params: { plan: params.plan } } : '/home';
    const codeInputRef = useRef<TextInput>(null);
    const passwordInputRef = useRef<TextInput>(null);
    const confirmPasswordInputRef = useRef<TextInput>(null);
    const [enteredEmail, setEmail] = useState(() => getEmailParameter(params.email));
    const email = resumeSession ? session.user!.email : enteredEmail;
    const [step, setStep] = useState<Step>(isVerification && !params.returnTo ? 'code' : 'email');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const complete = step === 'complete';

    async function requestCode() {
        if (loading) return;
        if (!email.includes('@')) {
            setErrorMessage('Enter a valid email address.');
            return;
        }

        setLoading(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            const response = isVerification
                ? await AuthService.requestEmailVerification({ email })
                : await AuthService.requestPasswordReset({ email });
            setStep('code');
            setCode('');
            if (step === 'code') setStatusMessage(response.message || 'Check your email for a code.');
            requestAnimationFrame(() => codeInputRef.current?.focus());
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error, 'Could not request a code.'));
        } finally {
            setLoading(false);
        }
    }

    async function submit() {
        if (loading) return;
        setErrorMessage('');
        setStatusMessage('');

        if (step === 'code' && !/^\d{6}$/.test(code)) {
            setErrorMessage('Enter the six-digit code.');
            return;
        }

        if (step === 'password') {
            const result = passwordSchema.safeParse(password);
            if (!result.success) {
                setErrorMessage(result.error.issues[0].message);
                return;
            }
        }

        if (step === 'password' && password !== confirmPassword) {
            setErrorMessage("Passwords don't match.");
            return;
        }

        setLoading(true);

        try {
            if (step === 'password') {
                await AuthService.resetPassword({ email, code, password });
            } else if (isVerification) {
                await AuthService.verifyEmail({ email, code });
            } else {
                await AuthService.verifyPasswordResetCode({ email, code });
                setStep('password');
                requestAnimationFrame(() => passwordInputRef.current?.focus());
                return;
            }
            Keyboard.dismiss();
            setCode('');
            setPassword('');
            setConfirmPassword('');
            setStep('complete');
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error, 'Something went wrong. Try again.'));
        } finally {
            setLoading(false);
        }
    }

    function changeStep(nextStep: 'email' | 'code') {
        setStep(nextStep);
        setCode('');
        setPassword('');
        setConfirmPassword('');
        setErrorMessage('');
        setStatusMessage('');
    }

    async function primaryAction() {
        if (loading) return;
        if (complete) {
            if (resumeSession) {
                setLoading(true);
                setErrorMessage('');
                try {
                    const user = await session.refreshUser();
                    if (!user.emailVerified) throw new Error('Verify your account email to continue.');
                    router.replace(inviteCode ? { pathname: '/join', params: { code: inviteCode } } : returnTo);
                } catch (error) {
                    setErrorMessage(getErrorMessage(error, 'Could not refresh your account. Try again.'));
                } finally {
                    setLoading(false);
                }
            } else router.replace({ pathname: '/login', params: { email, inviteCode } });
            return;
        }

        void (step === 'email' ? requestCode() : submit());
    }

    const copy = {
        email: {
            title: isVerification ? 'Verify Email' : 'Reset Password',
            description: 'Enter your email to request a code.',
            action: 'Send Code',
        },
        code: {
            title: isVerification ? 'Verify Email' : 'Verify Code',
            description: `Enter the 6-digit code sent to\n${email}`,
            action: 'Verify Code',
        },
        password: {
            title: 'New Password',
            description: `Choose a new password for\n${email}`,
            action: 'Reset Password',
        },
        complete: {
            title: isVerification ? 'Email Verified' : 'Password Reset',
            description: isVerification
                ? resumeSession
                    ? 'Your email is verified.'
                    : 'Email verified. You can now log in.'
                : 'Password updated. You can now log in.',
            action: resumeSession ? 'Continue' : 'Continue to Login',
        },
    }[step];

    return (
        <>
            <Head>
                <title>{`Tally | ${copy.title}`}</title>
            </Head>
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardAvoider}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardDismissMode={Platform.select({
                            ios: 'interactive',
                            android: 'on-drag',
                            default: 'none',
                        })}
                        keyboardShouldPersistTaps='handled'
                        showsVerticalScrollIndicator={false}
                        testID='email-auth-scroll'
                    >
                        <View style={styles.card}>
                            <View style={styles.header}>
                                <Text accessibilityRole='header' aria-level={1} style={styles.title}>
                                    {copy.title}
                                </Text>
                                <Text style={styles.subtitle}>{copy.description}</Text>
                            </View>

                            {step === 'email' && (
                                <FormField
                                    autoCapitalize='none'
                                    autoComplete='email'
                                    editable={!loading && !resumeSession}
                                    keyboardType='email-address'
                                    label='Email Address'
                                    onChangeText={setEmail}
                                    onSubmitEditing={() => void requestCode()}
                                    returnKeyType='done'
                                    testID='email-auth-email'
                                    textContentType='emailAddress'
                                    value={email}
                                />
                            )}

                            {step === 'code' && (
                                <FormField
                                    autoComplete='one-time-code'
                                    editable={!loading}
                                    keyboardType='number-pad'
                                    label='Verification Code'
                                    maxLength={6}
                                    onChangeText={setCode}
                                    onSubmitEditing={Keyboard.dismiss}
                                    ref={codeInputRef}
                                    returnKeyType='done'
                                    testID='email-auth-code'
                                    textContentType='oneTimeCode'
                                    value={code}
                                />
                            )}

                            {step === 'password' && (
                                <>
                                    <FormField
                                        autoCapitalize='none'
                                        autoComplete='new-password'
                                        editable={!loading}
                                        help={`${PASSWORD_REQUIREMENTS} Choose a password that differs from your current password.`}
                                        label='New Password'
                                        onChangeText={setPassword}
                                        onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                                        ref={passwordInputRef}
                                        returnKeyType='next'
                                        secureTextEntry
                                        testID='email-auth-password'
                                        textContentType='newPassword'
                                        value={password}
                                    />
                                    <FormField
                                        autoCapitalize='none'
                                        autoComplete='new-password'
                                        editable={!loading}
                                        label='Confirm New Password'
                                        onChangeText={setConfirmPassword}
                                        onSubmitEditing={() => void submit()}
                                        ref={confirmPasswordInputRef}
                                        returnKeyType='done'
                                        secureTextEntry
                                        testID='email-auth-confirm-password'
                                        textContentType='newPassword'
                                        value={confirmPassword}
                                    />
                                </>
                            )}

                            {!complete && Boolean(statusMessage) && (
                                <View accessibilityLiveRegion='polite' style={styles.statusBox}>
                                    <Text style={styles.statusText}>{statusMessage}</Text>
                                </View>
                            )}

                            {Boolean(errorMessage) && (
                                <View
                                    accessibilityLiveRegion='polite'
                                    accessibilityRole='alert'
                                    style={styles.errorBox}
                                    testID='email-auth-error'
                                >
                                    <Text style={styles.errorText}>{errorMessage}</Text>
                                </View>
                            )}

                            <Pressable
                                accessibilityRole='button'
                                disabled={loading}
                                onPress={() => void primaryAction()}
                                style={({ pressed }) => [
                                    styles.primaryButton,
                                    pressed && styles.primaryButtonPressed,
                                    loading && styles.primaryButtonDisabled,
                                ]}
                                testID={
                                    complete
                                        ? 'email-auth-login'
                                        : step === 'email'
                                          ? 'email-auth-request'
                                          : 'email-auth-submit'
                                }
                            >
                                {loading ? (
                                    <ActivityIndicator color={colors.onPrimary} />
                                ) : (
                                    <Text style={styles.primaryButtonText}>{copy.action}</Text>
                                )}
                            </Pressable>

                            {step === 'code' && (
                                <View style={styles.secondaryActions}>
                                    <Pressable
                                        accessibilityRole='button'
                                        disabled={loading}
                                        hitSlop={8}
                                        onPress={() => void requestCode()}
                                        style={({ pressed }) => pressed && styles.linkPressed}
                                        testID='email-auth-resend'
                                    >
                                        <Text style={styles.link}>Resend code</Text>
                                    </Pressable>
                                    {!resumeSession && (
                                        <Pressable
                                            accessibilityRole='button'
                                            disabled={loading}
                                            hitSlop={8}
                                            onPress={() => changeStep('email')}
                                            style={({ pressed }) => pressed && styles.linkPressed}
                                            testID='email-auth-change-email'
                                        >
                                            <Text style={styles.link}>Use a different email</Text>
                                        </Pressable>
                                    )}
                                </View>
                            )}

                            {step === 'password' && (
                                <View style={styles.secondaryActions}>
                                    <Pressable
                                        accessibilityRole='button'
                                        disabled={loading}
                                        hitSlop={8}
                                        onPress={() => changeStep('code')}
                                        style={({ pressed }) => pressed && styles.linkPressed}
                                        testID='email-auth-change-code'
                                    >
                                        <Text style={styles.link}>Use another code</Text>
                                    </Pressable>
                                </View>
                            )}

                            {!complete && (
                                <View style={styles.footer}>
                                    <Link
                                        href={
                                            resumeSession
                                                ? returnTo
                                                : { pathname: '/login', params: { email, inviteCode } }
                                        }
                                        asChild
                                    >
                                        <Pressable
                                            accessibilityRole='link'
                                            hitSlop={8}
                                            style={({ pressed }) => pressed && styles.linkPressed}
                                            testID='email-auth-login'
                                        >
                                            <Text style={styles.link}>
                                                {resumeSession ? 'Cancel' : 'Back to login'}
                                            </Text>
                                        </Pressable>
                                    </Link>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </>
    );
}
