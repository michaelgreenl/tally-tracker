import { MenuView } from '@expo/ui/community/menu';
import { useRef } from 'react';
import { Pressable } from 'react-native';

import type { CounterMenuProps } from './counter-menu';
import type { MenuComponentRef } from '@expo/ui/community/menu';

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
    const menu = useRef<MenuComponentRef>(null);
    return (
        <MenuView
            ref={menu}
            colorScheme='dark'
            testID={`counter-${counterId}-menu`}
            actions={[
                { id: 'edit', title: 'Edit' },
                {
                    id: 'share',
                    title: !isPremium ? 'Share (Premium)' : busy ? 'Sharing…' : 'Share',
                    attributes: { disabled: !isPremium || busy },
                },
                ...(moveUp || moveDown
                    ? [
                          { id: 'move-up', title: 'Move up', attributes: { disabled: !moveUp } },
                          { id: 'move-down', title: 'Move down', attributes: { disabled: !moveDown } },
                      ]
                    : []),
                { id: 'delete', title: 'Delete', attributes: { destructive: true } },
            ]}
            onPressAction={({ nativeEvent: { event } }) => {
                if (event === 'edit' || event === 'share' || event === 'delete') onAction(event);
                else if (event === 'move-up') moveUp?.();
                else if (event === 'move-down') moveDown?.();
            }}
        >
            <Pressable
                accessibilityRole='button'
                accessibilityLabel={`Actions for ${title}`}
                onPress={() => menu.current?.show()}
            >
                {children}
            </Pressable>
        </MenuView>
    );
}
