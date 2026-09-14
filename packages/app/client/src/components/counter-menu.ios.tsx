import { Button, Host, Menu, RNHostView } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled } from '@expo/ui/swift-ui/modifiers';

import type { CounterMenuProps } from './counter-menu';

export function CounterMenu({ counterId, title, isPremium, busy, onAction, children }: CounterMenuProps) {
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
                <Button label='Delete' role='destructive' onPress={() => onAction('delete')} />
            </Menu>
        </Host>
    );
}
