import { Button, Host, Menu, RNHostView } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled } from '@expo/ui/swift-ui/modifiers';

import type { CounterMenuProps } from './counter-menu';

export function CounterMenu({
    counterId,
    title,
    canShare,
    isOwner,
    busy,
    canReorder,
    onAction,
    children,
}: CounterMenuProps) {
    return (
        <Host matchContents colorScheme='dark' ignoreSafeArea='all'>
            <Menu
                label={
                    <RNHostView matchContents>
                        <>{children}</>
                    </RNHostView>
                }
                modifiers={[accessibilityLabel(`Actions for ${title}`)]}
                testID={`counter-${counterId}-menu`}
            >
                <Button label='Edit' onPress={() => onAction('edit')} />
                <Button
                    label={!canShare ? 'Share (Premium)' : busy ? 'Sharing…' : 'Share'}
                    modifiers={[disabled(!canShare || busy)]}
                    onPress={() => onAction('share')}
                />
                <Button
                    label='Reorder'
                    systemImage='line.3.horizontal'
                    modifiers={[disabled(!canReorder)]}
                    onPress={() => onAction('reorder')}
                />
                <Button label={isOwner ? 'Delete' : 'Leave'} role='destructive' onPress={() => onAction('delete')} />
            </Menu>
        </Host>
    );
}
