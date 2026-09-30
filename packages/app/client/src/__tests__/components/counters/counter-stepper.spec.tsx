// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import * as Haptics from 'expo-haptics';

import { CounterStepper } from '../../../components/counters/counter-stepper';

import type { PressableProps } from 'react-native';

vi.mock('react-native', () => ({
    Platform: { OS: 'ios' },
    StyleSheet: { create: (styles: unknown) => styles },
    View: 'div',
    Pressable: ({ onPress, disabled, testID, children }: PressableProps) =>
        createElement(
            'button',
            { onClick: onPress, disabled, 'data-testid': testID },
            typeof children === 'function' ? children({ pressed: false, hovered: false }) : children,
        ),
}));
vi.mock('react-native-svg', () => ({ default: 'svg', Path: 'path' }));
vi.mock('../../../components/counters/counter-number', () => ({
    CounterNumber: ({ value }: { value: number }) => value,
}));
vi.mock('expo-haptics', () => ({ selectionAsync: vi.fn() }));

it('gives feedback only for enabled presses and keeps counting when haptics are unavailable', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.mocked(Haptics.selectionAsync).mockRejectedValue(new Error('Haptics unavailable'));
    const container = document.createElement('div');
    const root = createRoot(container);
    let count = 0;
    try {
        await act(async () => {
            root.render(
                createElement(CounterStepper, {
                    value: count,
                    minimum: 0,
                    label: 'Count',
                    testID: 'stepper',
                    onIncrement: (amount) => (count += amount),
                    onEditValue: vi.fn(),
                }),
            );
        });
        container.querySelector<HTMLButtonElement>('[data-testid="stepper-decrease"]')!.click();
        expect(count).toBe(0);
        expect(Haptics.selectionAsync).not.toHaveBeenCalled();

        await act(async () => {
            container.querySelector<HTMLButtonElement>('[data-testid="stepper-increase"]')!.click();
        });
        expect(count).toBe(1);
        expect(Haptics.selectionAsync).toHaveBeenCalledOnce();
    } finally {
        await act(async () => root.unmount());
        vi.unstubAllGlobals();
    }
});
