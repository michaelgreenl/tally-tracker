import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
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
    const [email, setEmail] = useState(() => getEmailParameter(params.email));
    const [codeRequested, setCodeRequested] = useState(isVerification);
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
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error, 'Could not request a code.'));
        } finally {
            setLoading(false);
        }
    }

    async function submitCode() {
        if (!/^\d{6}$/.test(code)) {
            setErrorMessage('Enter the six-digit code.');
            return;
        }

        if (!isVerification && password !== confirmPassword) {
            setErrorMessage("Passwords don't match.");
            return;
        }

        setLoading(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            if (isVerification) {
                await AuthService.verifyEmail({ email, code });
            } else {
                await AuthService.resetPassword({ email, code, password });
            }
            router.replace('/login');
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error, 'Could not submit the code.'));
        } finally {
            setLoading(false);
        }
    }

    const title = isVerification ? 'Verify Email' : 'Reset Password';

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
                        keyboardShouldPersistTaps='handled'
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.card}>
                            <View style={styles.header}>
                                <Text accessibilityRole='header' aria-level={1} style={styles.title}>
                                    {title}
                                </Text>
                                <Text style={styles.subtitle}>
                                    {codeRequested
                                        ? 'Enter the code from your email, then press Submit.'
                                        : 'Enter your account email to request a code.'}
                                </Text>
                            </View>

                            <FormField
                                autoCapitalize='none'
                                autoComplete='email'
                                editable={!loading && !codeRequested}
                                keyboardType='email-address'
                                label='Email Address'
                                onChangeText={setEmail}
                                testID='email-auth-email'
                                textContentType='emailAddress'
                                value={email}
                            />

                            {codeRequested && (
                                <>
                                    <FormField
                                        autoComplete='one-time-code'
                                        editable={!loading}
                                        keyboardType='number-pad'
                                        label='Verification Code'
                                        maxLength={6}
                                        onChangeText={setCode}
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
                                                label='New Password'
                                                onChangeText={setPassword}
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
                                                secureTextEntry
                                                testID='email-auth-confirm-password'
                                                textContentType='newPassword'
                                                value={confirmPassword}
                                            />
                                        </>
                                    )}
                                </>
                            )}

                            {Boolean(statusMessage) && (
                                <Text accessibilityLiveRegion='polite' style={styles.subtitle}>
                                    {statusMessage}
                                </Text>
                            )}

                            {Boolean(errorMessage) && (
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
                                onPress={() => void (codeRequested ? submitCode() : requestCode())}
                                style={({ pressed }) => [
                                    styles.primaryButton,
                                    pressed && styles.primaryButtonPressed,
                                    loading && styles.primaryButtonDisabled,
                                ]}
                                testID={codeRequested ? 'email-auth-submit' : 'email-auth-request'}
                            >
                                {loading ? (
                                    <ActivityIndicator color='#ffffff' />
                                ) : (
                                    <Text style={styles.primaryButtonText}>
                                        {codeRequested ? 'Submit' : 'Send Code'}
                                    </Text>
                                )}
                            </Pressable>

                            {codeRequested && (
                                <Pressable
                                    accessibilityRole='button'
                                    disabled={loading}
                                    onPress={() => void requestCode()}
                                    style={styles.footer}
                                    testID='email-auth-resend'
                                >
                                    <Text style={styles.link}>Resend code</Text>
                                </Pressable>
                            )}

                            <View style={styles.footer}>
                                <Link href='/login' asChild>
                                    <Pressable accessibilityRole='link' hitSlop={8} testID='email-auth-login'>
                                        <Text style={styles.link}>Back to login</Text>
                                    </Pressable>
                                </Link>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </>
    );
}
