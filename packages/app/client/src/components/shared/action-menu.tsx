import { useId, useRef } from 'react';
import { Text } from 'react-native';

import { colors } from '../../theme/colors';

import type { CSSProperties, PropsWithChildren } from 'react';
import type { ButtonProps } from '@expo/ui/swift-ui';

export type ActionMenuProps = PropsWithChildren<{
    label: string;
    testID: string;
    actions: {
        id: string;
        label: string;
        onPress: () => void;
        disabled?: boolean;
        destructive?: boolean;
        systemImage?: ButtonProps['systemImage'];
    }[];
}>;

export function ActionMenu({ label, testID, actions, children }: ActionMenuProps) {
    const id = useId();
    const popover = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);

    return (
        <>
            <button
                ref={trigger}
                type='button'
                aria-label={label}
                popoverTarget={id}
                data-testid={`${testID}-menu`}
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
                aria-label={label}
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
                {actions.map(({ id, label, onPress, disabled, destructive }) => (
                    <button
                        key={id}
                        type='button'
                        disabled={disabled}
                        data-testid={`${testID}-${id}`}
                        onClick={() => {
                            popover.current?.hidePopover();
                            trigger.current?.focus();
                            onPress();
                        }}
                        style={{
                            ...buttonStyle,
                            width: '100%',
                            padding: '10px 12px',
                            justifyContent: 'flex-start',
                            color: destructive ? colors.danger : colors.text,
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
