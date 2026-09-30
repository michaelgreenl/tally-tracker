import { MenuView } from '@expo/ui/community/menu';
import { useRef } from 'react';
import { Pressable } from 'react-native';

import type { ActionMenuProps } from './action-menu';
import type { MenuComponentRef } from '@expo/ui/community/menu';

export function ActionMenu({ label, testID, actions, children }: ActionMenuProps) {
    const menu = useRef<MenuComponentRef>(null);
    return (
        <MenuView
            ref={menu}
            colorScheme='dark'
            testID={`${testID}-menu`}
            actions={actions.map((action) => ({
                id: action.id,
                title: action.label,
                attributes: { disabled: action.disabled, destructive: action.destructive },
            }))}
            onPressAction={({ nativeEvent: { event } }) => {
                const action = actions.find((action) => action.id === event);
                if (action && !action.disabled) action.onPress();
            }}
        >
            <Pressable
                accessibilityRole='button'
                accessibilityLabel={label}
                onPress={() => menu.current?.show()}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
                {children}
            </Pressable>
        </MenuView>
    );
}
