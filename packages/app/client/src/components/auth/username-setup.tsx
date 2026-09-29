import { usernameSchema } from '@tally/core/client';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../../contexts/session-context';
import { colors } from '../../theme/colors';
import { FormField, styles as formStyles } from '../shared/auth-form';
import { MessageText } from '../shared/message-text';

export function UsernameSetup() {
    const session = useSession();
    const input = useRef<TextInput>(null);
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    async function submit() {
        if (saving) return;
        const parsed = usernameSchema.safeParse(username);
        if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            input.current?.focus();
            return;
        }
        setError('');
        setSaving(true);
        const result = await session.setUsername(parsed.data);
        setSaving(false);
        if (!result.success) setError(result.message);
    }

    return (
        <Modal visible onRequestClose={() => {}} onShow={() => input.current?.focus()}>
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardAvoider}
                >
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
                        <View style={styles.card} testID='username-setup'>
                            <View style={styles.header}>
                                <Text accessibilityRole='header' style={styles.title}>
                                    Choose a username
                                </Text>
                                <MessageText style={styles.subtitle}>
                                    People on your shared counters will see this name.
                                </MessageText>
                            </View>
                            <FormField
                                ref={input}
                                label='Username'
                                help='Use 3+ letters, numbers, or underscores.'
                                autoCapitalize='none'
                                autoCorrect={false}
                                autoComplete='username-new'
                                textContentType='username'
                                editable={!saving}
                                value={username}
                                onChangeText={setUsername}
                                onSubmitEditing={() => void submit()}
                                returnKeyType='done'
                                testID='username-input'
                            />
                            {Boolean(error) && (
                                <View
                                    accessibilityRole='alert'
                                    accessibilityLiveRegion='polite'
                                    style={styles.errorBox}
                                    testID='username-error'
                                >
                                    <MessageText style={styles.errorText}>{error}</MessageText>
                                </View>
                            )}
                            <Pressable
                                accessibilityRole='button'
                                accessibilityLabel='Save username'
                                accessibilityState={{ disabled: saving, busy: saving }}
                                disabled={saving}
                                onPress={() => void submit()}
                                style={({ pressed }) => [
                                    styles.primaryButton,
                                    pressed && styles.primaryButtonPressed,
                                    saving && styles.primaryButtonDisabled,
                                ]}
                                testID='username-submit'
                            >
                                {saving ? (
                                    <ActivityIndicator color={colors.onPrimary} />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Continue</Text>
                                )}
                            </Pressable>
                            <Pressable
                                accessibilityRole='button'
                                disabled={saving}
                                onPress={() => void session.logout()}
                                style={({ pressed }) => [styles.logout, pressed && styles.linkPressed]}
                                testID='username-logout'
                            >
                                <Text style={styles.link}>Log out</Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    ...formStyles,
    scrollContent: { ...formStyles.scrollContent, justifyContent: 'center' },
    logout: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
