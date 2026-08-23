import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { useCounters } from '../counters';
import { useSession } from '../session';

import type { ClientCounter, CounterTypeType as CounterType, HexColor } from '@tally/core/client';

type CounterFormProps = {
    counter?: ClientCounter;
    onCancel: () => void;
    onDone: () => void;
};

const colors = ['#000000', '#0f7899', '#2563eb', '#7c3aed', '#be123c', '#15803d'] as const;
const isHexColor = (value: string): value is HexColor => /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value);

export function CounterForm({ counter, onCancel, onDone }: CounterFormProps) {
    const session = useSession();
    const counterState = useCounters();
    const [title, setTitle] = useState(counter?.title || '');
    const [color, setColor] = useState(counter?.color || '#000000');
    const [type, setType] = useState<CounterType>(counter?.type || 'PERSONAL');
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);

    async function submit() {
        if (!isHexColor(color)) {
            setErrorMessage('Enter a valid hex color, such as #0f7899');
            return;
        }

        setLoading(true);
        setErrorMessage('');
        const result = counter
            ? await counterState.updateCounter(counter.id, { title, color, type })
            : await counterState.createCounter(title, color, type);
        setLoading(false);

        if (!result.success) {
            setErrorMessage(result.message);
            return;
        }

        onDone();
    }

    return (
        <View style={styles.form} testID='home-counter-form'>
            <Text accessibilityRole='header' aria-level={2} style={styles.heading}>
                {counter ? 'Update Counter' : 'Create Counter'}
            </Text>

            <View style={styles.field}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                    accessibilityLabel='Counter title'
                    autoFocus
                    editable={!loading}
                    onChangeText={setTitle}
                    onSubmitEditing={() => void submit()}
                    placeholder='What are you counting?'
                    placeholderTextColor='#6c757d'
                    returnKeyType='done'
                    style={styles.input}
                    testID='counter-title'
                    value={title}
                />
            </View>

            <View style={styles.field}>
                <Text style={styles.label}>Color</Text>
                <View accessibilityLabel='Counter color choices' accessibilityRole='radiogroup' style={styles.colors}>
                    {colors.map((choice) => (
                        <Pressable
                            key={choice}
                            accessibilityLabel={`Color ${choice}`}
                            accessibilityRole='radio'
                            accessibilityState={{ selected: color.toLowerCase() === choice }}
                            onPress={() => setColor(choice)}
                            style={[
                                styles.color,
                                { backgroundColor: choice },
                                color.toLowerCase() === choice && styles.colorSelected,
                            ]}
                        />
                    ))}
                </View>
                <TextInput
                    accessibilityLabel='Custom hex color'
                    autoCapitalize='none'
                    editable={!loading}
                    maxLength={7}
                    onChangeText={setColor}
                    placeholder='#0f7899'
                    placeholderTextColor='#6c757d'
                    style={styles.input}
                    value={color}
                />
            </View>

            {!counter && (
                <View style={styles.shareRow}>
                    <View style={styles.shareCopy}>
                        <Text style={styles.label}>Enable Sharing</Text>
                        {!session.isPremium && <Text style={styles.premiumNote}>Premium feature</Text>}
                    </View>
                    <Switch
                        accessibilityLabel='Enable sharing'
                        disabled={!session.isPremium || loading}
                        onValueChange={(enabled) => setType(enabled ? 'SHARED' : 'PERSONAL')}
                        trackColor={{ false: '#adb5bd', true: '#23a6d5' }}
                        value={type === 'SHARED'}
                    />
                </View>
            )}

            {Boolean(errorMessage) && (
                <View accessibilityLiveRegion='polite' accessibilityRole='alert' style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            )}

            <View style={styles.actions}>
                <Pressable
                    accessibilityRole='button'
                    disabled={loading}
                    onPress={onCancel}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}
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
                    <Text style={styles.primaryText}>{loading ? 'Saving…' : counter ? 'Update' : 'Create'}</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    form: {
        gap: 20,
        padding: 22,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.12)',
        elevation: 3,
    },
    heading: {
        color: '#212529',
        fontSize: 24,
        fontWeight: '800',
    },
    field: {
        gap: 8,
    },
    label: {
        color: '#343a40',
        fontSize: 14,
        fontWeight: '700',
    },
    input: {
        minHeight: 50,
        paddingHorizontal: 14,
        color: '#212529',
        fontSize: 16,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#adb5bd',
        borderRadius: 10,
    },
    colors: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 4,
    },
    color: {
        width: 38,
        height: 38,
        borderWidth: 2,
        borderColor: '#ffffff',
        borderRadius: 19,
        boxShadow: '0 0 0 1px #adb5bd',
    },
    colorSelected: {
        boxShadow: '0 0 0 3px #23a6d5',
    },
    shareRow: {
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
    },
    shareCopy: {
        flex: 1,
        gap: 4,
    },
    premiumNote: {
        color: '#7c4a03',
        fontSize: 13,
    },
    errorBox: {
        padding: 12,
        backgroundColor: '#fde8e7',
        borderRadius: 8,
    },
    errorText: {
        color: '#b42318',
        fontSize: 14,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    primaryButton: {
        minWidth: 108,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        backgroundColor: '#0f7899',
        borderRadius: 10,
    },
    primaryPressed: {
        backgroundColor: '#0d6f8f',
    },
    primaryText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryButton: {
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: '#6c757d',
        borderRadius: 10,
    },
    secondaryPressed: {
        backgroundColor: '#e9ecef',
    },
    secondaryText: {
        color: '#343a40',
        fontSize: 15,
        fontWeight: '700',
    },
    disabled: {
        opacity: 0.65,
    },
});
