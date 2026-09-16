import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';
import ColorPicker, { HueSlider, Panel1 } from 'reanimated-color-picker';

import { colors } from '../colors';

export type CustomColorPickerProps = {
    value: string;
    onChange: (color: string) => void;
    disabled: boolean;
};

export function CustomColorPicker({ value, onChange, disabled }: CustomColorPickerProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Pressable
                accessibilityLabel={`Custom color, selected ${value}`}
                accessibilityRole='button'
                disabled={disabled}
                onPress={() => setOpen(true)}
                style={styles.button}
                testID='counter-custom-color'
            >
                <Svg width={52} height={52} viewBox='0 0 24 24' aria-hidden>
                    <Circle cx={12} cy={12} r={7} fill={value} />
                    {['#ef4444', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#d946ef'].map((color, index) => (
                        <Circle
                            key={color}
                            cx={12}
                            cy={12}
                            r={10}
                            fill='none'
                            stroke={color}
                            strokeWidth={4}
                            strokeDasharray='10.5 52.33'
                            transform={`rotate(${index * 60} 12 12)`}
                        />
                    ))}
                </Svg>
            </Pressable>
            <Modal animationType='fade' transparent visible={open} onRequestClose={() => setOpen(false)}>
                <GestureHandlerRootView style={styles.overlay}>
                    <View accessibilityViewIsModal style={styles.dialog} testID='counter-custom-color-dialog'>
                        <ScrollView contentContainerStyle={styles.content}>
                            <ColorPicker
                                value={value}
                                onCompleteJS={({ hex }) => onChange(hex)}
                                boundedThumb
                                thumbSize={24}
                                sliderThickness={28}
                                style={styles.picker}
                            >
                                <Panel1 accessibilityLabel='Color saturation and brightness' style={styles.spectrum} />
                                <HueSlider accessibilityLabel='Color hue' style={styles.hue} />
                            </ColorPicker>
                            <Pressable
                                accessibilityRole='button'
                                onPress={() => setOpen(false)}
                                style={styles.done}
                                testID='counter-custom-color-done'
                            >
                                <Text style={styles.doneText}>Done</Text>
                            </Pressable>
                        </ScrollView>
                    </View>
                </GestureHandlerRootView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    button: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: 30 },
    overlay: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.overlay,
    },
    dialog: { width: '100%', maxWidth: 460, maxHeight: '100%', backgroundColor: colors.surface, borderRadius: 16 },
    content: { padding: 24, gap: 16 },
    picker: { gap: 18 },
    spectrum: { height: 160, borderRadius: 10 },
    hue: { borderRadius: 14 },
    done: {
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: colors.primary,
    },
    doneText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
});
