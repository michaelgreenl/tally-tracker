import { BottomSheet, Host, RNHostView, VStack } from '@expo/ui/swift-ui';
import {
    interactiveDismissDisabled,
    presentationBackground,
    presentationDetents,
    presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '../colors';

import type { CounterSheetProps } from './counter-sheet';

export function CounterSheet({ visible, loading, onDismiss, children, footer }: CounterSheetProps) {
    const { width } = useWindowDimensions();

    return (
        <Host style={{ position: 'absolute', width }} pointerEvents='none'>
            <BottomSheet
                isPresented={visible}
                onIsPresentedChange={(presented) => {
                    if (!presented) onDismiss();
                }}
            >
                <VStack
                    spacing={0}
                    modifiers={[
                        presentationDetents([{ fraction: 0.5 }, { fraction: 0.9 }]),
                        presentationDragIndicator('visible'),
                        interactiveDismissDisabled(loading),
                        presentationBackground(colors.surface),
                    ]}
                    testID='home-counter-form'
                >
                    <RNHostView>
                        <GestureHandlerRootView style={{ flexGrow: 1, height: 0, paddingTop: 16 }}>
                            {children}
                        </GestureHandlerRootView>
                    </RNHostView>
                    {/* Native layout anchors the footer without resizing its React Native content during a drag. */}
                    <RNHostView matchContents>{footer}</RNHostView>
                </VStack>
            </BottomSheet>
        </Host>
    );
}
