import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function hapticFeedback(kind: 'selection' | 'impact' = 'selection') {
    if (Platform.OS === 'web') return;
    const feedback =
        Platform.OS === 'android'
            ? Haptics.performAndroidHapticsAsync(
                  kind === 'impact' ? Haptics.AndroidHaptics.Long_Press : Haptics.AndroidHaptics.Segment_Tick,
              )
            : kind === 'impact'
              ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              : Haptics.selectionAsync();
    // Unavailable haptics must not interrupt the action or reject without a handler.
    void feedback.catch(() => {});
}
