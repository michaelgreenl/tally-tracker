import { BottomSheet } from '@expo/ui/community/bottom-sheet';
import { useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '../../theme/colors';

import type { CounterSheetProps } from './counter-sheet';

export function CounterSheet({ visible, loading, onDismiss, children, footer }: CounterSheetProps) {
    const { fontScale } = useWindowDimensions();

    return (
        <BottomSheet
            index={visible ? 0 : -1}
            snapPoints={[`${Math.min(50 * fontScale, 85)}%`, '90%']}
            enablePanDownToClose={!loading}
            onDismiss={onDismiss}
            backgroundStyle={{ backgroundColor: colors.surface }}
        >
            <GestureHandlerRootView accessibilityViewIsModal style={{ flex: 1 }} testID='home-counter-form'>
                {children}
                {footer}
            </GestureHandlerRootView>
        </BottomSheet>
    );
}
