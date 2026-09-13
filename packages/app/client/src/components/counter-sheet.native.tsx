import { BottomSheet } from '@expo/ui/community/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '../colors';

import type { CounterSheetProps } from './counter-sheet';

export function CounterSheet({ visible, loading, onDismiss, children, footer }: CounterSheetProps) {
    return (
        <BottomSheet
            index={visible ? 0 : -1}
            snapPoints={['65%', '90%']}
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
