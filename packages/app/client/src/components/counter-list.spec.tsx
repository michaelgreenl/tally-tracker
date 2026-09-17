// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { CounterList } from './counter-list';

import type { CounterListProps } from './counter-list';
import type { Root } from 'react-dom/client';
import type { ScrollHandlers } from 'react-native-reanimated';

type PullContext = { dragging?: boolean; pulling?: boolean };
let handlers: ScrollHandlers<PullContext>;
let root: Root;

vi.mock('react-native', () => ({
    Platform: { OS: 'ios' },
    StyleSheet: { create: (styles: unknown) => styles },
    View: 'div',
    RefreshControl: () => null,
}));
vi.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'div' }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('./counter-card', () => ({ counterLayoutTransition: undefined }));
// Stub the native event transport, not the list's pull-state handlers.
vi.mock('react-native-reanimated', () => ({
    useReducedMotion: () => true,
    useAnimatedScrollHandler: (callbacks: ScrollHandlers<PullContext>) => callbacks,
}));
vi.mock('react-native-worklets', () => ({
    scheduleOnRN: (callback: (pulling: boolean) => void, pulling: boolean) => callback(pulling),
}));
vi.mock('react-native-reorderable-list', () => ({
    default: ({ onScroll }: { onScroll: ScrollHandlers<PullContext> }) => {
        handlers = onScroll;
        return null;
    },
}));

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    root = createRoot(document.createElement('div'));
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
});

it('keeps an iOS pull active until release, not during bounce or reorder', async () => {
    let pulling = false;
    const props: CounterListProps = {
        counters: [],
        reordering: false,
        refreshing: false,
        onRefresh: vi.fn(),
        onPullChange: (value) => {
            pulling = value;
        },
        onReorder: vi.fn(),
        renderItem: () => null,
        emptyState: null,
    };
    const context: PullContext = {};
    const emit = (name: keyof typeof handlers, y: number) => {
        const event = { contentOffset: { y }, contentInset: { top: 20 } } as Parameters<
            NonNullable<typeof handlers.onScroll>
        >[0];
        handlers[name]?.(event, context);
    };
    await act(async () => root.render(createElement(CounterList, props)));

    emit('onScroll', -40);
    expect(pulling).toBe(false); // A bounce without a held drag is not a pull.
    emit('onBeginDrag', 0);
    emit('onScroll', -20);
    expect(pulling).toBe(false); // The inset alone is not a pull.
    emit('onScroll', -60);
    expect(pulling).toBe(true);

    await act(async () => root.render(createElement(CounterList, { ...props, refreshing: true })));
    await act(async () => root.render(createElement(CounterList, { ...props, refreshing: false })));
    emit('onScroll', -20);
    expect(pulling).toBe(true); // A completed refresh must not clear a held pull.
    emit('onEndDrag', -20);
    emit('onScroll', -40);
    expect(pulling).toBe(false);

    emit('onBeginDrag', -20);
    emit('onScroll', -60);
    expect(pulling).toBe(true);
    await act(async () => root.render(createElement(CounterList, { ...props, reordering: true })));
    emit('onBeginDrag', -20);
    emit('onScroll', -60);
    expect(pulling).toBe(false);
});
