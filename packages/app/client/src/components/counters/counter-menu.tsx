import { ActionMenu } from '../shared/action-menu';

import type { PropsWithChildren } from 'react';

type CounterMenuProps = PropsWithChildren<{
    counterId: string;
    title: string;
    canShare: boolean;
    isOwner: boolean;
    busy: boolean;
    canReorder: boolean;
    onAction: (action: 'edit' | 'reset' | 'share' | 'delete' | 'reorder') => void;
}>;

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
        <ActionMenu
            label={`Actions for ${title}`}
            testID={`counter-${counterId}`}
            actions={[
                { id: 'edit', label: 'Edit', onPress: () => onAction('edit') },
                { id: 'reset', label: 'Reset', onPress: () => onAction('reset') },
                {
                    id: 'share',
                    label: !canShare ? 'Share (Premium)' : busy ? 'Sharing…' : 'Share',
                    disabled: !canShare || busy,
                    onPress: () => onAction('share'),
                },
                {
                    id: 'reorder',
                    label: 'Reorder',
                    systemImage: 'line.3.horizontal',
                    disabled: !canReorder,
                    onPress: () => onAction('reorder'),
                },
                {
                    id: 'delete',
                    label: isOwner ? 'Delete' : 'Leave',
                    destructive: true,
                    onPress: () => onAction('delete'),
                },
            ]}
        >
            {children}
        </ActionMenu>
    );
}
