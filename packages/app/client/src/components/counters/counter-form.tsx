import { useState } from 'react';
import { COUNTER_TITLE_MAX_LENGTH } from '@tally/core/client';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { useCounters } from '../../contexts/counter-context';
import { FormField } from '../shared/auth-form';
import { CounterSheet } from './counter-sheet';
import { MessageText } from '../shared/message-text';

import type { ClientCounter, HexColor } from '@tally/core/client';

type CounterFormProps = {
    visible: boolean;
    counter?: ClientCounter;
    onCancel: () => void;
    onDone: () => void;
};

export function CounterForm({ visible, counter, onCancel, onDone }: CounterFormProps) {
    const counterState = useCounters();
    const insets = useSafeAreaInsets();
    const [title, setTitle] = useState(counter?.title || '');
    const [metric, setMetric] = useState(counter?.metric || '');
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const [wasVisible, setWasVisible] = useState(visible);

    if (visible !== wasVisible) {
        setWasVisible(visible);
        if (visible) {
            setTitle(counter?.title || '');
            setMetric(counter?.metric || '');
            setErrorMessage('');
        }
    }

    function dismiss() {
        if (!loading) onCancel();
    }

    async function submit() {
        if (loading) return;
        if (!title.trim()) {
            setErrorMessage('Name is required.');
            return;
        }

        setLoading(true);
        setErrorMessage('');
        const result = counter
            ? await counterState.updateCounter(counter.id, { title, metric })
            : await counterState.createCounter(title, '#000000' as HexColor, metric);
        setLoading(false);

        if (!result.success) {
            setErrorMessage(result.message);
            return;
        }

        onDone();
    }

    return (
        <CounterSheet
            visible={visible}
            loading={loading}
            onDismiss={dismiss}
            footer={
                <View style={[styles.actions, { paddingBottom: Math.max(16, insets.bottom) }]}>
                    <Pressable
                        accessibilityRole='button'
                        disabled={loading}
                        onPress={dismiss}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}
                        testID='counter-form-cancel'
                    >
                        <Text style={styles.secondaryText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole='button'
                        disabled={loading}
                        onPress={() => void submit()}
                        style={({ pressed }) => [
                            styles.primaryButton,
                            pressed && styles.primaryPressed,
                            loading && styles.disabled,
                        ]}
                        testID='counter-form-submit'
                    >
                        <Text style={styles.primaryText}>{loading ? 'Saving…' : counter ? 'Update' : 'Add'}</Text>
                    </Pressable>
                </View>
            }
        >
            <View style={styles.sheet}>
                <Text accessibilityRole='header' aria-level={2} style={styles.heading}>
                    {counter ? 'Update Counter' : 'Add Counter'}
                </Text>

                <ScrollView
                    contentContainerStyle={styles.form}
                    keyboardShouldPersistTaps='handled'
                    keyboardDismissMode={Platform.select({ ios: 'interactive', android: 'on-drag', default: 'none' })}
                    testID='counter-form-scroll'
                >
                    <FormField
                        editable={!loading}
                        label='Name'
                        maxLength={COUNTER_TITLE_MAX_LENGTH}
                        onChangeText={setTitle}
                        onSubmitEditing={() => void submit()}
                        placeholder='What are you counting?'
                        returnKeyType='done'
                        testID='counter-title'
                        value={title}
                    />

                    <FormField
                        editable={!loading}
                        label='Metric (optional)'
                        value={metric}
                        onChangeText={setMetric}
                        placeholder='e.g. 16oz water bottle'
                        maxLength={80}
                        returnKeyType='done'
                        onSubmitEditing={() => void submit()}
                        testID='counter-metric'
                    />

                    {Boolean(errorMessage) && (
                        <View
                            accessibilityLiveRegion='polite'
                            accessibilityRole='alert'
                            style={styles.errorBox}
                            testID='counter-form-error'
                        >
                            <MessageText style={styles.errorText}>{errorMessage}</MessageText>
                        </View>
                    )}
                </ScrollView>
            </View>
        </CounterSheet>
    );
}

const styles = StyleSheet.create({
    sheet: {
        ...(Platform.OS === 'web' ? { flexShrink: 1 } : { flex: 1 }),
        backgroundColor: colors.surface,
    },
    heading: {
        padding: 22,
        color: colors.text,
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
    },
    form: {
        paddingHorizontal: 22,
        paddingBottom: 8,
    },
    errorBox: {
        padding: 12,
        marginTop: 8,
        backgroundColor: colors.dangerSurface,
        borderRadius: 8,
    },
    errorText: {
        color: colors.danger,
        fontSize: 14,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        paddingHorizontal: 22,
        paddingTop: 12,
    },
    primaryButton: {
        minWidth: 108,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        backgroundColor: colors.primary,
        borderRadius: 10,
    },
    primaryPressed: {
        backgroundColor: colors.primaryPressed,
    },
    primaryText: {
        color: colors.onPrimary,
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryButton: {
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
    },
    secondaryPressed: {
        backgroundColor: colors.input,
    },
    secondaryText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    disabled: {
        opacity: 0.65,
    },
});
