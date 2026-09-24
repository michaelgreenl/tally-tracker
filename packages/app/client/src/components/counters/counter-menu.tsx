import { useId, useRef } from 'react';
import { Text } from 'react-native';

import { colors } from '../../theme/colors';

import type { CSSProperties, PropsWithChildren } from 'react';

export type CounterMenuProps = PropsWithChildren<{
    counterId: string;
    title: string;
    canShare: boolean;
    isOwner: boolean;
    busy: boolean;
    canReorder: boolean;
    onAction: (action: 'edit' | 'share' | 'delete' | 'reorder') => void;
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
    const id = useId();
    const popover = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const shareLabel = !canShare ? 'Share (Premium)' : busy ? 'Sharing…' : 'Share';
    const actions = [
        { id: 'edit', label: 'Edit', run: () => onAction('edit'), disabled: false },
        { id: 'share', label: shareLabel, run: () => onAction('share'), disabled: !canShare || busy },
        { id: 'reorder', label: 'Reorder', run: () => onAction('reorder'), disabled: !canReorder },
        { id: 'delete', label: isOwner ? 'Delete' : 'Leave', run: () => onAction('delete'), disabled: false },
    ];

    return (
        <>
            <button
                ref={trigger}
                type='button'
                aria-label={`Actions for ${title}`}
                popoverTarget={id}
                data-testid={`counter-${counterId}-menu`}
                onClick={(event) => {
                    if (!popover.current) return;
                    const bounds = event.currentTarget.getBoundingClientRect();
                    popover.current.style.top = `${bounds.bottom}px`;
                    popover.current.style.right = `${window.innerWidth - bounds.right}px`;
                }}
                style={{ ...buttonStyle, padding: 0 }}
            >
                {children}
            </button>
            <div
                ref={popover}
                id={id}
                popover='auto'
                aria-label={`Actions for ${title}`}
                style={{
                    position: 'fixed',
                    inset: 'auto',
                    margin: 0,
                    minWidth: 180,
                    padding: 6,
                    border: `1px solid ${colors.divider}`,
                    borderRadius: 12,
                    background: colors.surface,
                    boxShadow: '0 6px 24px #0006',
                }}
            >
                {actions.map(({ id, label, run, disabled }) => (
                    <button
                        key={id}
                        type='button'
                        disabled={disabled}
                        data-testid={`counter-${counterId}-${id}`}
                        onClick={() => {
                            popover.current?.hidePopover();
                            trigger.current?.focus();
                            run?.();
                        }}
                        style={{
                            ...buttonStyle,
                            width: '100%',
                            padding: '10px 12px',
                            justifyContent: 'flex-start',
                            color: id === 'delete' ? colors.danger : colors.text,
                            opacity: disabled ? 0.5 : 1,
                        }}
                    >
                        <Text style={{ color: 'inherit', fontSize: 16 }}>{label}</Text>
                    </button>
                ))}
            </div>
        </>
    );
}

const buttonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    border: 0,
    borderRadius: 8,
    background: 'transparent',
    color: colors.text,
    cursor: 'pointer',
};
