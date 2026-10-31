import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const HAPTICS_KEY = 'haptics_enabled';
let enabled = true;

export const loadHapticsSetting = () =>
    AsyncStorage.getItem(HAPTICS_KEY)
        .then((value) => {
            enabled = value !== 'false';
        })
        .catch(() => {});

export const hapticsEnabled = () => enabled;

export function setHapticsEnabled(value: boolean) {
    enabled = value;
    // A failed save keeps the choice until the app closes.
    void AsyncStorage.setItem(HAPTICS_KEY, String(value)).catch(() => {});
}

export function hapticFeedback(kind: 'selection' | 'impact' = 'selection') {
    if (Platform.OS === 'web' || !enabled) return;
    const feedback =
        Platform.OS === 'android'
            ? Haptics.performAndroidHapticsAsync(
                  kind === 'impact' ? Haptics.AndroidHaptics.Long_Press : Haptics.AndroidHaptics.Segment_Tick,
              )
            : Haptics.impactAsync(
                  kind === 'impact' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium,
              );
    // Unavailable haptics must not interrupt the action or reject without a handler.
    void feedback.catch(() => {});
}
