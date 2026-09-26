import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '../../theme/colors';

import type { PropsWithChildren, ReactElement } from 'react';

export type CounterSheetProps = PropsWithChildren<{
    visible: boolean;
    loading: boolean;
    onDismiss: () => void;
    footer: ReactElement;
}>;

export function CounterSheet({ visible, loading, onDismiss, children, footer }: CounterSheetProps) {
    return (
        <Modal animationType='fade' onRequestClose={onDismiss} transparent visible={visible}>
            <GestureHandlerRootView style={styles.overlay}>
                <View accessibilityViewIsModal style={styles.sheet} testID='home-counter-form'>
                    {children}
                    {footer}
                </View>
                <Pressable
                    accessible={false}
                    tabIndex={-1}
                    disabled={loading}
                    onPress={onDismiss}
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
        paddingTop: 16,
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: colors.overlay,
    },
    sheet: {
        zIndex: 1,
        width: '100%',
        maxWidth: 560,
        maxHeight: '100%',
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
});
