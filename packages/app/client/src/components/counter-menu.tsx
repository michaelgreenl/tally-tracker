import { useId, useRef } from 'react';
import { Text } from 'react-native';

import { colors } from '../colors';

import type { CSSProperties, PropsWithChildren } from 'react';

export type CounterMenuProps = PropsWithChildren<{
    counterId: string;
    title: string;
    isPremium: boolean;
    busy: boolean;
    onAction: (action: 'edit' | 'share' | 'delete') => void;
}>;

export function CounterMenu({ counterId, title, isPremium, busy, onAction, children }: CounterMenuProps) {
    const id = useId();
    const popover = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const shareLabel = !isPremium ? 'Share (Premium)' : busy ? 'Sharing…' : 'Share';

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
                {(['edit', 'share', 'delete'] as const).map((action) => (
                    <button
                        key={action}
                        type='button'
                        disabled={action === 'share' && (!isPremium || busy)}
                        data-testid={`counter-${counterId}-${action}`}
                        onClick={() => {
                            popover.current?.hidePopover();
                            trigger.current?.focus();
                            onAction(action);
                        }}
                        style={{
                            ...buttonStyle,
                            width: '100%',
                            padding: '10px 12px',
                            justifyContent: 'flex-start',
                            color: action === 'delete' ? colors.danger : colors.text,
                            opacity: action === 'share' && (!isPremium || busy) ? 0.5 : 1,
                        }}
                    >
                        <Text style={{ color: 'inherit', fontSize: 16 }}>
                            {action === 'edit' ? 'Edit' : action === 'delete' ? 'Delete' : shareLabel}
                        </Text>
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
