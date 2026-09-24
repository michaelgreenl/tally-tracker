import { Button, Host, Image } from '@expo/ui/swift-ui';
import {
    accessibilityLabel,
    buttonBorderShape,
    buttonStyle,
    controlSize,
    disabled,
    frame,
    tint,
} from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';

import { colors } from '../../theme/colors';

import type { ToolbarButtonProps } from './toolbar-button';

export function ToolbarButton({ label, icon, role, disabled: unavailable, onPress, testID }: ToolbarButtonProps) {
    const glass = Number.parseInt(String(Platform.Version), 10) >= 26;
    const cancel = role === 'cancel' || icon === 'close';
    return (
        <Host matchContents colorScheme='dark' ignoreSafeArea='all'>
            <Button
                label={icon ? undefined : label}
                role={cancel ? 'cancel' : 'default'}
                onPress={onPress}
                testID={testID}
                modifiers={[
                    accessibilityLabel(label),
                    disabled(Boolean(unavailable)),
                    controlSize(icon ? 'regular' : 'large'),
                    buttonStyle(
                        cancel ? (glass ? 'glass' : 'bordered') : glass ? 'glassProminent' : 'borderedProminent',
                    ),
                    buttonBorderShape(icon ? 'circle' : 'capsule'),
                    tint(cancel ? colors.text : colors.primary),
                    frame({ minWidth: 48, minHeight: 48 }),
                ]}
            >
                {icon && (
                    <Image
                        systemName={icon === 'close' ? 'xmark' : 'checkmark'}
                        size={18}
                        modifiers={[frame({ width: 24, height: 24 })]}
                    />
                )}
            </Button>
        </Host>
    );
}
