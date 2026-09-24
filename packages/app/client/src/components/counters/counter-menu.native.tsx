import { MenuView } from '@expo/ui/community/menu';
import { useRef } from 'react';
import { Pressable } from 'react-native';

import type { CounterMenuProps } from './counter-menu';
import type { MenuComponentRef } from '@expo/ui/community/menu';

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
                    title: !canShare ? 'Share (Premium)' : busy ? 'Sharing…' : 'Share',
                    attributes: { disabled: !canShare || busy },
                },
                { id: 'reorder', title: 'Reorder', attributes: { disabled: !canReorder } },
                { id: 'delete', title: isOwner ? 'Delete' : 'Leave', attributes: { destructive: true } },
            ]}
            onPressAction={({ nativeEvent: { event } }) => {
                if (event === 'edit' || event === 'share' || event === 'delete' || event === 'reorder') onAction(event);
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
