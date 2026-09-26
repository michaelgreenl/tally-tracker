import { useId, useState } from 'react';
import { addCounterAmount, counterIncrementSchema, counterValueSchema } from '@tally/core/client';
import { InputAccessoryView, Keyboard, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../theme/colors';
import { useCounters } from '../../contexts/counter-context';
import { Dialog } from '../shared/dialog';
import { CounterStepper, counterNumberStyle } from './counter-stepper';
import { ToolbarButton } from '../shared/toolbar-button';

import type { ClientCounter } from '@tally/core/client';

export function CounterValueDialog({
    counter,
    field,
    onClose,
}: {
    counter: ClientCounter;
    field: 'count' | 'increment';
    onClose: () => void;
}) {
    const { updateCounter, incrementCounter } = useCounters();
    const keyboardToolbarID = useId();
    const isIncrement = field === 'increment';
    const [draft, setDraft] = useState(String(counter[field] ?? 1));
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const value = Number(draft.trim().replace(',', '.'));
    const valid =
        /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(draft.trim()) &&
        (isIncrement ? counterIncrementSchema : counterValueSchema).safeParse(value).success;

    function finishEditing() {
        Keyboard.dismiss();
        if (valid) setEditing(false);
    }

    async function save() {
        if (saving) return;
        if (!valid) {
            setError(
                isIncrement
                    ? 'Enter a positive number. Use up to 6 decimals.'
                    : 'Enter a number. Use up to 6 decimals.',
            );
            return;
        }
        // Apply the change from the opened value, preserving taps received while editing.
        const amount = addCounterAmount(value, -counter.count);
        if (!isIncrement && !counterValueSchema.safeParse(amount).success) {
            setError('This change exceeds the counter limit.');
            return;
        }
        if (!isIncrement && amount === 0) {
            onClose();
            return;
        }
        setSaving(true);
        const result = isIncrement
            ? await updateCounter(counter.id, { increment: value })
            : await incrementCounter(counter.id, amount);
        setSaving(false);
        if (result.success) onClose();
        else setError(result.message);
    }

    return (
        <Dialog
            visible
            dismissOnBackdropPress
            onShow={() => {
                if (!isIncrement) setEditing(true);
            }}
            onRequestClose={() => {
                if (!saving) onClose();
            }}
            title={isIncrement ? 'Increment' : 'Count'}
            description={isIncrement ? 'Amount added or removed' : undefined}
            testID={`counter-${field}-dialog`}
            leadingAction={
                <ToolbarButton
                    label={`Cancel ${field} changes`}
                    icon='close'
                    disabled={saving}
                    onPress={onClose}
                    testID={`counter-${field}-cancel`}
                />
            }
            trailingAction={
                <ToolbarButton
                    label={saving ? `Saving ${field}` : `Save ${field}`}
                    icon='check'
                    disabled={saving}
                    onPress={() => void save()}
                    testID={`counter-${field}-save`}
                />
            }
        >
            <CounterStepper
                value={value}
                label={field}
                increment={isIncrement ? 1 : (counter.increment ?? 1)}
                minimum={isIncrement ? 0.000001 : undefined}
                disabled={saving || !valid}
                testID={`${field}-editor`}
                onEditValue={() => setEditing(true)}
                onIncrement={(amount) => {
                    setDraft(String(addCounterAmount(value, amount)));
                    setEditing(false);
                    setError('');
                }}
            >
                {editing && (
                    <TextInput
                        accessibilityLabel={isIncrement ? 'Increment value' : 'Counter value'}
                        autoFocus
                        selectTextOnFocus
                        inputMode={isIncrement ? 'decimal' : undefined}
                        keyboardType={isIncrement ? 'decimal-pad' : 'numbers-and-punctuation'}
                        returnKeyType='done'
                        inputAccessoryViewID={Platform.OS === 'ios' ? keyboardToolbarID : undefined}
                        value={draft}
                        onChangeText={(text) => {
                            setDraft(text);
                            setError('');
                        }}
                        editable={!saving}
                        style={[counterNumberStyle, styles.input]}
                        onSubmitEditing={finishEditing}
                        testID={`counter-${field}-value`}
                    />
                )}
            </CounterStepper>
            {Platform.OS === 'ios' && (
                <InputAccessoryView nativeID={keyboardToolbarID}>
                    <View style={styles.keyboardToolbar}>
                        <ToolbarButton label='Done' onPress={finishEditing} testID={`counter-${field}-keyboard-done`} />
                    </View>
                </InputAccessoryView>
            )}
            {Boolean(error) && (
                <Text
                    accessibilityRole='alert'
                    accessibilityLiveRegion='polite'
                    style={styles.error}
                    testID={`counter-${field}-error`}
                >
                    {error}
                </Text>
            )}
        </Dialog>
    );
}

const styles = StyleSheet.create({
    keyboardToolbar: { alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 12 },
    input: {
        minHeight: 52,
        padding: 4,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: colors.link,
        backgroundColor: colors.input,
    },
    error: { color: colors.danger, fontSize: 14 },
});
