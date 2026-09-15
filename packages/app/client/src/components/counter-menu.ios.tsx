import { Button, Host, Menu, RNHostView } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled } from '@expo/ui/swift-ui/modifiers';

import type { CounterMenuProps } from './counter-menu';

export function CounterMenu({
    counterId,
    title,
    isPremium,
    busy,
    onAction,
    moveUp,
    moveDown,
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
                    label={!isPremium ? 'Share (Premium)' : busy ? 'Sharing…' : 'Share'}
                    modifiers={[disabled(!isPremium || busy)]}
                    onPress={() => onAction('share')}
                />
                {(moveUp || moveDown) && (
                    <>
                        <Button label='Move up' modifiers={[disabled(!moveUp)]} onPress={moveUp} />
                        <Button label='Move down' modifiers={[disabled(!moveDown)]} onPress={moveDown} />
                    </>
                )}
                <Button label='Delete' role='destructive' onPress={() => onAction('delete')} />
            </Menu>
        </Host>
    );
}
