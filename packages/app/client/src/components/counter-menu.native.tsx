import { MenuView } from '@expo/ui/community/menu';
import { useRef } from 'react';
import { Pressable } from 'react-native';

import type { CounterMenuProps } from './counter-menu';
import type { MenuComponentRef } from '@expo/ui/community/menu';

export function CounterMenu({ counterId, title, isPremium, busy, onAction, children }: CounterMenuProps) {
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
                { id: 'delete', title: 'Delete', attributes: { destructive: true } },
            ]}
            onPressAction={({ nativeEvent: { event } }) => {
                if (event === 'edit' || event === 'share' || event === 'delete') onAction(event);
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
