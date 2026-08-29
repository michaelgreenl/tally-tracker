import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../session';

import type { TextInputProps } from 'react-native';

type AuthScreenProps = {
    mode: 'login' | 'register';
};

export function FormField({ label, ...inputProps }: TextInputProps & { label: string }) {
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
                style={[styles.input, focused && styles.inputFocused, inputProps.style]}
            />
        </View>
    );
}

const legalLinks = [
    { label: 'Privacy', document: 'privacy' },
    { label: 'Terms', document: 'terms' },
    { label: 'Support', document: 'support' },
] as const;

export function AuthScreen({ mode }: AuthScreenProps) {
    const router = useRouter();
    const session = useSession();
    const isLogin = mode === 'login';
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    async function submit() {
        if (!isLogin && password !== confirmPassword) {
            setErrorMessage("Passwords don't match");
            return;
        }

        if (!isLogin && !email.includes('@')) {
            setErrorMessage('Please enter a valid email address');
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
                <title>{`Tally Tracker | ${isLogin ? 'Login' : 'Register'}`}</title>
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
                                    {isLogin ? 'Welcome to Tally Tracker' : 'Create Account'}
                                </Text>
                                {isLogin ? (
                                    <Link href='/home' asChild>
                                        <Pressable accessibilityRole='link' hitSlop={8} testID='continue-as-guest'>
                                            <Text style={styles.link}>Continue as guest</Text>
                                        </Pressable>
                                    </Link>
                                ) : (
                                    <Text style={styles.subtitle}>Get started with Tally App</Text>
                                )}
                            </View>

                            <FormField
                                autoCapitalize='none'
                                autoComplete='email'
                                editable={!loading}
                                keyboardType='email-address'
                                label='Email Address'
                                onChangeText={setEmail}
                                placeholder='name@example.com'
                                returnKeyType='next'
                                testID='auth-email'
                                textContentType='emailAddress'
                                value={email}
                            />

                            <View style={styles.field}>
                                <Text style={styles.label}>Password</Text>
                                <View
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
                                        }}
                                        placeholderTextColor='#8d969e'
                                        returnKeyType={isLogin ? 'done' : 'next'}
                                        secureTextEntry={!showPassword}
                                        style={styles.passwordTextInput}
                                        testID='auth-password'
                                        textContentType={isLogin ? 'password' : 'newPassword'}
                                        value={password}
                                    />
                                    <Pressable
                                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                                        accessibilityRole='button'
                                        hitSlop={8}
                                        onPress={() => setShowPassword((visible) => !visible)}
                                    >
                                        <Text style={styles.passwordToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
                                    </Pressable>
                                </View>
                            </View>

                            {!isLogin && (
                                <FormField
                                    autoCapitalize='none'
                                    autoComplete='new-password'
                                    editable={!loading}
                                    label='Confirm Password'
                                    onChangeText={setConfirmPassword}
                                    onSubmitEditing={() => void submit()}
                                    returnKeyType='done'
                                    secureTextEntry
                                    testID='auth-confirm-password'
                                    textContentType='newPassword'
                                    value={confirmPassword}
                                />
                            )}

                            {isLogin && Platform.OS === 'web' && (
                                <View style={styles.rememberRow}>
                                    <Text style={styles.rememberLabel}>Remember me</Text>
                                    <Switch
                                        accessibilityLabel='Remember me'
                                        disabled={loading}
                                        onValueChange={setRememberMe}
                                        thumbColor='#f8f9fa'
                                        trackColor={{ false: '#adb5bd', true: '#23a6d5' }}
                                        value={rememberMe}
                                    />
                                </View>
                            )}

                            {isLogin && (
                                <Link href='/forgot-password' asChild>
                                    <Pressable accessibilityRole='link' hitSlop={8} style={styles.forgotPassword}>
                                        <Text style={styles.link}>Forgot password?</Text>
                                    </Pressable>
                                </Link>
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
                                <Link href={isLogin ? '/register' : '/login'} asChild>
                                    <Pressable accessibilityRole='link' hitSlop={8}>
                                        <Text style={styles.link}>
                                            {isLogin ? 'Create an account' : 'Already have an account?'}
                                        </Text>
                                    </Pressable>
                                </Link>
                                <View
                                    accessibilityLabel='Legal links'
                                    accessibilityRole='summary'
                                    style={styles.legalLinks}
                                >
                                    {legalLinks.map((link) => (
                                        <Link
                                            key={link.document}
                                            href={{
                                                pathname: '/legal/[document]',
                                                params: { document: link.document },
                                            }}
                                            asChild
                                        >
                                            <Pressable accessibilityRole='link' hitSlop={8}>
                                                <Text style={styles.legalLink}>{link.label}</Text>
                                            </Pressable>
                                        </Link>
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
    keyboardAvoider: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
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
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 10,
    },
    inputFocused: {
        borderColor: '#23a6d5',
        borderWidth: 2,
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
        borderWidth: 1,
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
        color: '#167ca3',
        fontSize: 14,
        fontWeight: '700',
    },
    rememberRow: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    rememberLabel: {
        color: '#343a40',
        fontSize: 15,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 18,
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
    primaryButton: {
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f7899',
        borderRadius: 10,
    },
    primaryButtonPressed: {
        backgroundColor: '#0d6f8f',
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
    link: {
        color: '#167ca3',
        fontSize: 15,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    legalLinks: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 18,
    },
    legalLink: {
        color: '#575e64',
        fontSize: 13,
        textDecorationLine: 'underline',
    },
});

export { styles as authScreenStyles };
