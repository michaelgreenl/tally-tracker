import { ColorPicker, Host } from '@expo/ui/swift-ui';
import { disabled, labelsHidden, scaleEffect } from '@expo/ui/swift-ui/modifiers';

import type { CustomColorPickerProps } from './custom-color-picker';

export function CustomColorPicker({ value, onChange, disabled: isDisabled }: CustomColorPickerProps) {
    return (
        <Host style={{ width: 60, height: 60 }} colorScheme='dark'>
            <ColorPicker
                label='Custom color'
                selection={value}
                onSelectionChange={onChange}
                supportsOpacity={false}
                modifiers={[labelsHidden(), scaleEffect(52 / 28), disabled(isDisabled)]}
                testID='counter-custom-color'
            />
        </Host>
    );
}
