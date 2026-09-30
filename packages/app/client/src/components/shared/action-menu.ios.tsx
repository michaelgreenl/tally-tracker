import { Button, Host, Menu, RNHostView } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled } from '@expo/ui/swift-ui/modifiers';

import type { ActionMenuProps } from './action-menu';

export function ActionMenu({ label, testID, actions, children }: ActionMenuProps) {
    return (
        <Host matchContents colorScheme='dark' ignoreSafeArea='all'>
            <Menu
                label={
                    <RNHostView matchContents>
                        <>{children}</>
                    </RNHostView>
                }
                modifiers={[accessibilityLabel(label)]}
                testID={`${testID}-menu`}
            >
                {actions.map((action) => (
                    <Button
                        key={action.id}
                        label={action.label}
                        systemImage={action.systemImage}
                        role={action.destructive ? 'destructive' : 'default'}
                        modifiers={[disabled(Boolean(action.disabled))]}
                        onPress={action.onPress}
                        testID={`${testID}-${action.id}`}
                    />
                ))}
            </Menu>
        </Host>
    );
}
