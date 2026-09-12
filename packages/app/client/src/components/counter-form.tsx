import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView, LegacyScrollView as ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import ColorPicker, { HueSlider, Panel1 } from 'reanimated-color-picker';

import { colors } from '../colors';
import { useCounters } from '../counters';
import { useSession } from '../session';
import { FormField } from './auth-form';
import { Checkbox } from './checkbox';

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
        <Modal animationType='slide' onRequestClose={dismiss} transparent visible={visible}>
            <GestureHandlerRootView style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    pointerEvents='box-none'
                    style={[styles.keyboardAvoider, { paddingTop: insets.top + 16 }]}
                >
                    <View
                        accessibilityViewIsModal
                        style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom) }]}
                        testID='home-counter-form'
                    >
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
                                <View style={styles.colorLabel}>
                                    <Text style={styles.label}>Color</Text>
                                    <View
                                        accessibilityLabel={`Selected color ${color}`}
                                        style={[styles.colorPreview, { backgroundColor: color }]}
                                        testID='counter-color-preview'
                                    />
                                </View>
                                <View pointerEvents={loading ? 'none' : 'auto'}>
                                    <ColorPicker
                                        value={color}
                                        onCompleteJS={({ hex }) => {
                                            if (!loading) setColor(hex);
                                        }}
                                        boundedThumb
                                        thumbSize={24}
                                        sliderThickness={28}
                                        style={styles.picker}
                                    >
                                        <Panel1
                                            accessibilityLabel='Color saturation and brightness'
                                            style={styles.spectrum}
                                        />
                                        <HueSlider accessibilityLabel='Color hue' style={styles.hue} />
                                    </ColorPicker>
                                </View>
                                <View
                                    accessibilityLabel='Counter color choices'
                                    accessibilityRole='radiogroup'
                                    style={styles.colors}
                                >
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
                                </View>
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

                        <View style={styles.actions}>
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
                                <Text style={styles.primaryText}>
                                    {loading ? 'Saving…' : counter ? 'Update' : 'Add'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
                <Pressable
                    accessible={false}
                    tabIndex={-1}
                    disabled={loading}
                    onPress={dismiss}
                    style={StyleSheet.absoluteFill}
                    testID='counter-form-backdrop'
                />
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
    },
    keyboardAvoider: {
        flex: 1,
        zIndex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    sheet: {
        width: '100%',
        maxWidth: 560,
        maxHeight: '100%',
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
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
        gap: 12,
    },
    label: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    colorLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    colorPreview: {
        width: 28,
        height: 20,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: colors.border,
    },
    picker: {
        gap: 18,
    },
    spectrum: {
        height: 160,
        borderRadius: 10,
    },
    hue: {
        borderRadius: 14,
    },
    colors: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    swatchButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 22,
    },
    color: {
        width: 30,
        height: 30,
        borderWidth: 2,
        borderColor: colors.surface,
        borderRadius: 15,
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
