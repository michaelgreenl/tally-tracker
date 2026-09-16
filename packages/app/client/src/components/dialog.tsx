import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

import { colors } from '../colors';

import type { PropsWithChildren, ReactNode } from 'react';
import type { ModalProps } from 'react-native';

type DialogProps = PropsWithChildren<
    Pick<ModalProps, 'visible' | 'onRequestClose' | 'testID'> & {
        title: string;
        description: string;
        leadingAction?: ReactNode;
        trailingAction?: ReactNode;
    }
>;

export function Dialog({
    visible,
    onRequestClose,
    testID,
    title,
    description,
    leadingAction,
    trailingAction,
    children,
}: DialogProps) {
    const { width } = useWindowDimensions();
    const hasHeaderActions = Boolean(leadingAction || trailingAction);

    return (
        <Modal animationType='fade' onRequestClose={onRequestClose} transparent visible={visible}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
                <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={styles.overlay}>
                    <View
                        accessibilityViewIsModal
                        style={[
                            styles.card,
                            hasHeaderActions && styles.editorCard,
                            hasHeaderActions && width >= 600 && styles.narrowCard,
                        ]}
                        testID={testID}
                    >
                        <View style={[styles.header, hasHeaderActions && styles.editorHeader]}>
                            {leadingAction && <View style={styles.headerAction}>{leadingAction}</View>}
                            <Text
                                accessibilityRole='header'
                                aria-level={2}
                                style={[styles.title, hasHeaderActions && styles.centeredTitle]}
                            >
                                {title}
                            </Text>
                            {trailingAction && <View style={styles.headerAction}>{trailingAction}</View>}
                        </View>
                        <Text style={[styles.description, hasHeaderActions && styles.editorDescription]}>
                            {description}
                        </Text>
                        {children}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    keyboard: { flex: 1, backgroundColor: colors.overlay },
    overlay: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 460,
        gap: 16,
        padding: 24,
        backgroundColor: colors.surface,
        borderRadius: 16,
    },
    editorCard: { gap: 4, padding: 16, paddingBottom: 32 },
    narrowCard: { width: '60%' },
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '800',
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    editorHeader: { alignItems: 'flex-end' },
    headerAction: { marginBottom: 8 },
    centeredTitle: { flex: 1, fontSize: 24, fontWeight: '600', textAlign: 'center' },
    description: {
        color: colors.muted,
        fontSize: 16,
        lineHeight: 24,
    },
    editorDescription: { textAlign: 'center', marginBottom: 18 },
});
