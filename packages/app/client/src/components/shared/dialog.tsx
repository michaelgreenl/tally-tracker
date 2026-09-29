import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

import { colors } from '../../theme/colors';
import { MessageText } from './message-text';

import type { PropsWithChildren, ReactNode } from 'react';
import type { ModalProps } from 'react-native';

type DialogProps = PropsWithChildren<
    Pick<ModalProps, 'visible' | 'onRequestClose' | 'onShow' | 'testID'> & {
        title: string;
        description?: string;
        descriptionGap?: number;
        contentGap?: number;
        dismissOnBackdropPress?: boolean;
        leadingAction?: ReactNode;
        trailingAction?: ReactNode;
    }
>;

export function Dialog({
    visible,
    onRequestClose,
    onShow,
    testID,
    title,
    description,
    descriptionGap,
    contentGap,
    dismissOnBackdropPress = false,
    leadingAction,
    trailingAction,
    children,
}: DialogProps) {
    const { width } = useWindowDimensions();
    const hasEditorActions = Boolean(leadingAction);

    return (
        <Modal animationType='fade' onRequestClose={onRequestClose} onShow={onShow} transparent visible={visible}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
                <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={styles.overlay}>
                    <View
                        accessibilityViewIsModal
                        style={[
                            styles.card,
                            hasEditorActions && styles.editorCard,
                            hasEditorActions && width >= 600 && styles.narrowCard,
                            contentGap !== undefined && { gap: contentGap },
                        ]}
                        testID={testID}
                    >
                        <View style={{ gap: descriptionGap ?? (hasEditorActions ? 4 : 16) }}>
                            <View style={[styles.header, hasEditorActions && styles.editorHeader]}>
                                {leadingAction && <View style={styles.headerAction}>{leadingAction}</View>}
                                <Text
                                    accessibilityRole='header'
                                    aria-level={2}
                                    style={[styles.title, hasEditorActions && styles.centeredTitle]}
                                    testID={testID ? `${testID}-title` : undefined}
                                >
                                    {title}
                                </Text>
                                {trailingAction && (
                                    <View style={hasEditorActions ? styles.headerAction : styles.closeAction}>
                                        {trailingAction}
                                    </View>
                                )}
                            </View>
                            {description && (
                                <MessageText style={[styles.description, hasEditorActions && styles.editorDescription]}>
                                    {description}
                                </MessageText>
                            )}
                        </View>
                        {children}
                    </View>
                    {dismissOnBackdropPress && (
                        <Pressable
                            accessible={false}
                            tabIndex={-1}
                            onPress={onRequestClose}
                            style={StyleSheet.absoluteFill}
                            testID={testID ? `${testID}-backdrop` : undefined}
                        />
                    )}
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
        zIndex: 1,
        width: '100%',
        maxWidth: 460,
        gap: 16,
        padding: 24,
        backgroundColor: colors.surface,
        borderRadius: 16,
    },
    editorCard: { gap: 12, padding: 16, paddingBottom: 32 },
    narrowCard: { width: '60%' },
    title: {
        flex: 1,
        color: colors.text,
        fontSize: 22,
        fontWeight: '800',
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    editorHeader: { paddingTop: 24 },
    headerAction: { transform: [{ translateY: '-50%' }] },
    closeAction: { alignSelf: 'flex-start' },
    centeredTitle: { flex: 1, fontSize: 24, fontWeight: '600', textAlign: 'center' },
    description: {
        color: colors.muted,
        fontSize: 16,
        lineHeight: 24,
    },
    editorDescription: { textAlign: 'center', marginBottom: 10 },
});
