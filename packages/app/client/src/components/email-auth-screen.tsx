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

import { getErrorMessage } from '../api';
import { AuthService } from '../services/auth.service';
import { authScreenStyles as styles, FormField } from './auth-screen';

type EmailAuthScreenProps = {
    mode: 'verify' | 'reset';
};

const getEmailParameter = (email: string | string[] | undefined) =>
    typeof email === 'string' ? email : email?.[0] || '';

export function EmailAuthScreen({ mode }: EmailAuthScreenProps) {
    const router = useRouter();
    const params = useLocalSearchParams<{ email?: string | string[] }>();
    const isVerification = mode === 'verify';
    const codeInputRef = useRef<TextInput>(null);
    const passwordInputRef = useRef<TextInput>(null);
    const confirmPasswordInputRef = useRef<TextInput>(null);
    const [email, setEmail] = useState(() => getEmailParameter(params.email));
    const [codeRequested, setCodeRequested] = useState(isVerification);
    const [complete, setComplete] = useState(false);
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    async function requestCode() {
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
            setCodeRequested(true);
            setStatusMessage(response.message || 'Check your email for a code.');
            requestAnimationFrame(() => codeInputRef.current?.focus());
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error, 'Could not request a code.'));
        } finally {
            setLoading(false);
        }
    }

    async function submitCode() {
        setErrorMessage('');
        setStatusMessage('');

        if (!/^\d{6}$/.test(code)) {
            setErrorMessage('Enter the six-digit code.');
            return;
        }

        if (!isVerification && password.length < 6) {
            setErrorMessage('Password must be at least 6 characters.');
            return;
        }

        if (!isVerification && password !== confirmPassword) {
            setErrorMessage("Passwords don't match.");
            return;
        }

        setLoading(true);

        try {
            if (isVerification) {
                await AuthService.verifyEmail({ email, code });
            } else {
                await AuthService.resetPassword({ email, code, password });
            }
            Keyboard.dismiss();
            setComplete(true);
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error, 'Could not submit the code.'));
        } finally {
            setLoading(false);
        }
    }

    function changeEmail() {
        setCodeRequested(false);
        setCode('');
        setPassword('');
        setConfirmPassword('');
        setErrorMessage('');
        setStatusMessage('');
    }

    function primaryAction() {
        if (complete) {
            router.replace('/login');
            return;
        }

        void (codeRequested ? submitCode() : requestCode());
    }

    const title = isVerification ? 'Verify Email' : 'Reset Password';
    const completionTitle = isVerification ? 'Email Verified' : 'Password Reset';

    return (
        <>
            <Head>
                <title>{`Tally Tracker | ${title}`}</title>
            </Head>
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardAvoider}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        keyboardShouldPersistTaps='handled'
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.card}>
                            <View style={styles.header}>
                                <Text accessibilityRole='header' aria-level={1} style={styles.title}>
                                    {complete ? completionTitle : title}
                                </Text>
                                <Text style={styles.subtitle}>
                                    {complete
                                        ? isVerification
                                            ? 'Your email is verified. You can now log in.'
                                            : 'Your password is updated. You can now log in.'
                                        : codeRequested
                                          ? 'Enter the code from your email, then press Submit.'
                                          : 'Enter your account email to request a code.'}
                                </Text>
                            </View>

                            {!complete && (
                                <FormField
                                    autoCapitalize='none'
                                    autoComplete='email'
                                    editable={!loading && !codeRequested}
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

                            {!complete && codeRequested && (
                                <>
                                    <FormField
                                        autoComplete='one-time-code'
                                        editable={!loading}
                                        keyboardType='number-pad'
                                        label='Verification Code'
                                        maxLength={6}
                                        onChangeText={setCode}
                                        onSubmitEditing={() => {
                                            if (isVerification) Keyboard.dismiss();
                                            else passwordInputRef.current?.focus();
                                        }}
                                        ref={codeInputRef}
                                        returnKeyType={isVerification ? 'done' : 'next'}
                                        testID='email-auth-code'
                                        textContentType='oneTimeCode'
                                        value={code}
                                    />

                                    {!isVerification && (
                                        <>
                                            <FormField
                                                autoCapitalize='none'
                                                autoComplete='new-password'
                                                editable={!loading}
                                                help='Use at least 6 characters. Choose a password that differs from your current password.'
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
                                                onSubmitEditing={() => void submitCode()}
                                                ref={confirmPasswordInputRef}
                                                returnKeyType='done'
                                                secureTextEntry
                                                testID='email-auth-confirm-password'
                                                textContentType='newPassword'
                                                value={confirmPassword}
                                            />
                                        </>
                                    )}
                                </>
                            )}

                            {!complete && Boolean(statusMessage) && (
                                <View accessibilityLiveRegion='polite' style={styles.statusBox}>
                                    <Text style={styles.statusText}>{statusMessage}</Text>
                                </View>
                            )}

                            {!complete && Boolean(errorMessage) && (
                                <View
                                    accessibilityLiveRegion='polite'
                                    accessibilityRole='alert'
                                    style={styles.errorBox}
                                >
                                    <Text style={styles.errorText}>{errorMessage}</Text>
                                </View>
                            )}

                            <Pressable
                                accessibilityRole='button'
                                disabled={loading}
                                onPress={primaryAction}
                                style={({ pressed }) => [
                                    styles.primaryButton,
                                    pressed && styles.primaryButtonPressed,
                                    loading && styles.primaryButtonDisabled,
                                ]}
                                testID={
                                    complete
                                        ? 'email-auth-login'
                                        : codeRequested
                                          ? 'email-auth-submit'
                                          : 'email-auth-request'
                                }
                            >
                                {loading ? (
                                    <ActivityIndicator color='#ffffff' />
                                ) : (
                                    <Text style={styles.primaryButtonText}>
                                        {complete ? 'Continue to Login' : codeRequested ? 'Submit' : 'Send Code'}
                                    </Text>
                                )}
                            </Pressable>

                            {!complete && codeRequested && (
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
                                    <Pressable
                                        accessibilityRole='button'
                                        disabled={loading}
                                        hitSlop={8}
                                        onPress={changeEmail}
                                        style={({ pressed }) => pressed && styles.linkPressed}
                                        testID='email-auth-change-email'
                                    >
                                        <Text style={styles.link}>Use a different email</Text>
                                    </Pressable>
                                </View>
                            )}

                            {!complete && (
                                <View style={styles.footer}>
                                    <Link href='/login' asChild>
                                        <Pressable
                                            accessibilityRole='link'
                                            hitSlop={8}
                                            style={({ pressed }) => pressed && styles.linkPressed}
                                            testID='email-auth-login'
                                        >
                                            <Text style={styles.link}>Back to login</Text>
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
