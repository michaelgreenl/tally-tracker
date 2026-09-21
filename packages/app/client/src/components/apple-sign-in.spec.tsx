// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppleSignIn } from './apple-sign-in.ios';
import { changeSession } from '../services/session-scope';
import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import type { AppleAuthenticationSignInOptions } from 'expo-apple-authentication';

const mocks = vi.hoisted(() => ({
    signIn: vi.fn(),
    login: vi.fn(),
    connect: vi.fn(),
    connection: vi.fn(),
    refreshUser: vi.fn(),
}));
let focused = true;
let root: Root;
let container: HTMLDivElement;
const props = { onError: vi.fn(), onSuccess: vi.fn(), onBusyChange: vi.fn() };

// Only native views and SDK transport are replaced. These tests cover callbacks, not native appearance.
vi.mock('react-native', () => ({
    StyleSheet: { create: (styles: unknown) => styles },
    useWindowDimensions: () => ({ fontScale: 1 }),
    View: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
    Text: ({ children }: { children?: ReactNode }) => createElement('span', null, children),
    ActivityIndicator: ({ testID }: { testID: string }) => createElement('span', { 'data-testid': testID }),
}));
vi.mock('expo-router', () => ({
    useFocusEffect: (effect: () => void | (() => void)) => {
        const isFocused = focused;
        useEffect(() => (isFocused ? effect() : undefined), [effect, isFocused]);
    },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('../session', () => ({ useSession: () => ({ login: mocks.login, refreshUser: mocks.refreshUser }) }));
vi.mock('../api', () => ({ ApiError: class extends Error {}, getErrorMessage: (error: Error) => error.message }));
vi.mock('../services/auth.service', () => ({
    AuthService: { connectApple: mocks.connect, appleConnection: mocks.connection },
}));
vi.mock('expo-apple-authentication', () => ({
    isAvailableAsync: async () => true,
    signInAsync: mocks.signIn,
    AppleAuthenticationScope: { EMAIL: 0 },
    AppleAuthenticationButtonType: { CONTINUE: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0 },
    AppleAuthenticationButton: ({ onPress, testID }: { onPress: () => void; testID: string }) =>
        createElement('button', { onClick: onPress, 'data-testid': testID }),
}));

async function render(connect = false, disabled = false) {
    await act(async () => {
        root.render(createElement(AppleSignIn, { ...props, connect, disabled, rememberMe: true }));
        await vi.dynamicImportSettled();
    });
}

async function press() {
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="apple-sign-in"]')!.click());
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubEnv('EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED', 'true');
    changeSession();
    focused = true;
    container = document.createElement('div');
    root = createRoot(container);
    mocks.signIn.mockImplementation(async ({ state }: AppleAuthenticationSignInOptions) => ({
        state,
        authorizationCode: 'apple-code',
    }));
    mocks.login.mockResolvedValue({ success: true });
    mocks.connection.mockResolvedValue({ success: true, data: { connected: false } });
    mocks.connect.mockResolvedValue({ success: true });
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

it('submits the returned code with its original nonce and blocks disabled presses', async () => {
    await render(false, true);
    await press();
    expect(mocks.signIn).not.toHaveBeenCalled();
    await render();
    await press();
    expect(mocks.login).toHaveBeenCalledWith({
        authorizationCode: 'apple-code',
        nonce: mocks.signIn.mock.calls[0][0].nonce,
        rememberMe: true,
    });
    expect(props.onSuccess).toHaveBeenCalledOnce();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
});

it('does not submit a credential whose state belongs to a different attempt', async () => {
    mocks.signIn.mockResolvedValue({ authorizationCode: 'apple-code', state: 'other-attempt' });
    await render();
    await press();
    expect(mocks.login).not.toHaveBeenCalled();
    expect(props.onError).toHaveBeenLastCalledWith(expect.any(String));
    expect(props.onError.mock.lastCall?.[0]).not.toBe('');
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
});

it('stops its loading state after native cancellation without showing an error', async () => {
    mocks.signIn.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    await render();
    await press();
    expect(mocks.login).not.toHaveBeenCalled();
    expect(props.onError.mock.calls).toEqual([['']]);
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
    expect(container.querySelector('[data-testid="apple-sign-in"]')).not.toBeNull();
});

it.each(['account change', 'leave and return'])('ignores an SDK result after %s', async (transition) => {
    let complete!: (value: unknown) => void;
    mocks.signIn.mockReturnValue(new Promise((resolve) => (complete = resolve)));
    await render();
    await press();
    if (transition === 'account change') changeSession('another-user');
    else {
        focused = false;
        await render();
        focused = true;
        await render();
    }
    await act(async () => complete({ authorizationCode: 'old-code', state: mocks.signIn.mock.calls[0][0].state }));
    expect(mocks.login).not.toHaveBeenCalled();
    expect(props.onSuccess).not.toHaveBeenCalled();
});

it('connects Apple to the signed-in account without starting a new login', async () => {
    changeSession('existing-user');
    await render(true);
    await press();
    expect(mocks.connect).toHaveBeenCalledWith({
        authorizationCode: 'apple-code',
        nonce: mocks.signIn.mock.calls[0][0].nonce,
        rememberMe: true,
    });
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.refreshUser).toHaveBeenCalledOnce();
    expect(props.onSuccess).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-testid="apple-sign-in"]')).toBeNull();
});
