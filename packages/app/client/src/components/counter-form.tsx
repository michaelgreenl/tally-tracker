import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../colors';
import { useCounters } from '../counters';
import { useSession } from '../session';
import { FormField } from './auth-form';
import { Checkbox } from './checkbox';
import { CounterSheet } from './counter-sheet';
import { CustomColorPicker } from './custom-color-picker';

import type { ClientCounter, CounterTypeType as CounterType, HexColor } from '@tally/core/client';

type CounterFormProps = {
    visible: boolean;
    counter?: ClientCounter;
    onCancel: () => void;
    onDone: () => void;
};

const colorChoices = ['#000000', '#0f7899', '#2563eb', '#7c3aed', '#be123c', '#15803d'] as const;
const isHexColor = (value: string): value is HexColor => /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value);

export function CounterForm({ visible, counter, onCancel, onDone }: CounterFormProps) {
    const session = useSession();
    const counterState = useCounters();
    const insets = useSafeAreaInsets();
    const [title, setTitle] = useState(counter?.title || '');
    const [color, setColor] = useState(counter?.color || '#000000');
    const [type, setType] = useState<CounterType>(counter?.type || 'PERSONAL');
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const [wasVisible, setWasVisible] = useState(visible);

    if (visible !== wasVisible) {
        setWasVisible(visible);
        if (visible) {
            setTitle(counter?.title || '');
            setColor(counter?.color || '#000000');
            setType(counter?.type || 'PERSONAL');
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
        if (!isHexColor(color)) {
            setErrorMessage('Choose a valid color.');
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
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    testID='counter-form-scroll'
                >
                    <FormField
                        editable={!loading}
                        label='Name'
                        onChangeText={setTitle}
                        onSubmitEditing={() => void submit()}
                        placeholder='What are you counting?'
                        returnKeyType='done'
                        testID='counter-title'
                        value={title}
                    />

                    <View style={styles.field}>
                        <Text style={styles.label}>Color</Text>
                        <ScrollView
                            horizontal
                            alwaysBounceHorizontal={false}
                            accessibilityLabel='Counter color choices'
                            contentContainerStyle={styles.colorChoices}
                            keyboardShouldPersistTaps='handled'
                            style={styles.colors}
                            testID='counter-color-choices'
                        >
                            <CustomColorPicker value={color} onChange={setColor} disabled={loading} />
                            {colorChoices.map((choice) => (
                                <Pressable
                                    key={choice}
                                    accessibilityLabel={`Color ${choice}`}
                                    accessibilityRole='radio'
                                    accessibilityState={{ checked: color.toLowerCase() === choice }}
                                    disabled={loading}
                                    onPress={() => setColor(choice)}
                                    style={styles.swatchButton}
                                    testID={`counter-color-${choice.slice(1)}`}
                                >
                                    <View
                                        style={[
                                            styles.color,
                                            { backgroundColor: choice },
                                            color.toLowerCase() === choice && styles.colorSelected,
                                        ]}
                                    />
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>

                    {!counter && (
                        <View style={styles.shareRow}>
                            <Checkbox
                                label='Enable sharing'
                                disabled={!session.isPremium || loading}
                                onValueChange={(enabled) => setType(enabled ? 'SHARED' : 'PERSONAL')}
                                value={type === 'SHARED'}
                                testID='counter-sharing'
                            />
                            <Text style={styles.label}>Enable sharing</Text>
                            <Svg
                                accessibilityLabel='Premium feature'
                                accessibilityRole='image'
                                width={18}
                                height={18}
                                viewBox='0 0 24 24'
                            >
                                <Path
                                    d='m3 6 4 4 5-7 5 7 4-4-2 12H5L3 6Zm3 15h12'
                                    fill='none'
                                    stroke={colors.warning}
                                    strokeWidth={1.8}
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                />
                            </Svg>
                        </View>
                    )}

                    {Boolean(errorMessage) && (
                        <View
                            accessibilityLiveRegion='polite'
                            accessibilityRole='alert'
                            style={styles.errorBox}
                            testID='counter-form-error'
                        >
                            <Text style={styles.errorText}>{errorMessage}</Text>
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
    field: {
        // Controls have 4px above each circle, matching the other labels' 7px gap.
        gap: 3,
    },
    label: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    colors: {
        flexGrow: 0,
    },
    colorChoices: {
        gap: 16,
    },
    swatchButton: {
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 30,
    },
    color: {
        width: 52,
        height: 52,
        borderWidth: 2,
        borderColor: colors.surface,
        borderRadius: 26,
        boxShadow: `0 0 0 1px ${colors.border}`,
    },
    colorSelected: {
        boxShadow: `0 0 0 3px ${colors.link}`,
    },
    shareRow: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
