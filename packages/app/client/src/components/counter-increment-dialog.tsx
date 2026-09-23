import { useState } from 'react';
import { addCounterAmount, counterIncrementSchema } from '@tally/core/client';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { colors } from '../colors';
import { useCounters } from '../counters/counter-context';
import { Dialog } from './dialog';
import { CounterStepper, counterNumberStyle } from './counter-stepper';
import { CounterNumber } from './counter-number';
import { ToolbarButton } from './toolbar-button';

import type { ClientCounter } from '@tally/core/client';

export function CounterIncrementDialog({ counter, onClose }: { counter: ClientCounter; onClose: () => void }) {
    const { updateCounter } = useCounters();
    const [draft, setDraft] = useState(String(counter.increment ?? 1));
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const value = Number(draft.trim().replace(',', '.'));
    const valid = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(draft.trim()) && counterIncrementSchema.safeParse(value).success;

    async function save() {
        if (saving) return;
        if (!valid) {
            setError('Enter a positive number with up to 6 decimal places (less than 1 billion).');
            return;
        }
        setSaving(true);
        const result = await updateCounter(counter.id, { increment: value });
        setSaving(false);
        if (result.success) onClose();
        else setError(result.message);
    }

    return (
        <Dialog
            visible
            dismissOnBackdropPress
            onRequestClose={() => {
                if (!saving) onClose();
            }}
            title='Increment'
            description='Amount added or removed'
            testID='counter-increment-dialog'
            leadingAction={
                <ToolbarButton
                    label='Cancel increment changes'
                    icon='close'
                    disabled={saving}
                    onPress={onClose}
                    testID='counter-increment-cancel'
                />
            }
            trailingAction={
                <ToolbarButton
                    label={saving ? 'Saving increment' : 'Save increment'}
                    icon='check'
                    disabled={saving}
                    onPress={() => void save()}
                    testID='counter-increment-save'
                />
            }
        >
            <CounterStepper
                value={value}
                label='increment'
                minimum={0.000001}
                disabled={saving || !valid}
                testID='increment-editor'
                onIncrement={(amount) => {
                    setDraft(String(addCounterAmount(value, amount)));
                    setEditing(false);
                    setError('');
                }}
            >
                {editing ? (
                    <TextInput
                        accessibilityLabel='Increment value'
                        autoFocus
                        selectTextOnFocus
                        inputMode='decimal'
                        keyboardType='decimal-pad'
                        returnKeyType='done'
                        value={draft}
                        onChangeText={(text) => {
                            setDraft(text);
                            setError('');
                        }}
                        editable={!saving}
                        style={[counterNumberStyle, styles.input]}
                        onSubmitEditing={() => {
                            if (valid) setEditing(false);
                        }}
                        testID='counter-increment-value'
                    />
                ) : (
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel={`Edit increment value, currently ${value}`}
                        onPress={() => setEditing(true)}
                        disabled={saving}
                        style={styles.valueButton}
                        testID='counter-increment-edit'
                    >
                        <CounterNumber value={value} style={counterNumberStyle} />
                    </Pressable>
                )}
            </CounterStepper>
            {Boolean(error) && (
                <Text
                    accessibilityRole='alert'
                    accessibilityLiveRegion='polite'
                    style={styles.error}
                    testID='counter-increment-error'
                >
                    {error}
                </Text>
            )}
        </Dialog>
    );
}

const styles = StyleSheet.create({
    valueButton: { minHeight: 52, minWidth: 80, flexShrink: 1, justifyContent: 'center' },
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
