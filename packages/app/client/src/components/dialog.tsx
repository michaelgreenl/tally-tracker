import { Modal, StyleSheet, Text, View } from 'react-native';

import type { PropsWithChildren } from 'react';
import type { ModalProps } from 'react-native';

type DialogProps = PropsWithChildren<
    Pick<ModalProps, 'visible' | 'onRequestClose' | 'testID'> & {
        title: string;
        description: string;
    }
>;

export function Dialog({ visible, onRequestClose, testID, title, description, children }: DialogProps) {
    return (
        <Modal animationType='fade' onRequestClose={onRequestClose} transparent visible={visible}>
            <View accessibilityViewIsModal style={styles.overlay} testID={testID}>
                <View style={styles.card}>
                    <Text accessibilityRole='header' aria-level={2} style={styles.title}>
                        {title}
                    </Text>
                    <Text style={styles.description}>{description}</Text>
                    {children}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    card: {
        width: '100%',
        maxWidth: 460,
        gap: 16,
        padding: 24,
        backgroundColor: '#ffffff',
        borderRadius: 16,
    },
    title: {
        color: '#212529',
        fontSize: 22,
        fontWeight: '800',
    },
    description: {
        color: '#343a40',
        fontSize: 16,
        lineHeight: 24,
    },
});
