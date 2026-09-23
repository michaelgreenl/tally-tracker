// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppleSignIn } from './apple-sign-in.ios';
import { SignInMethods } from '../settings/sign-in-methods';
import { changeSession } from '../../session/session-scope';
import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import type { AppleAuthenticationSignInOptions } from 'expo-apple-authentication';

const mocks = vi.hoisted(() => ({
    signIn: vi.fn(),
    login: vi.fn(),
    connect: vi.fn(),
    connection: vi.fn(),
    connectGoogle: vi.fn(),
    refreshUser: vi.fn(),
}));
let focused = true;
let root: Root;
let container: HTMLDivElement;
const props = { onError: vi.fn(), onSuccess: vi.fn(), onBusyChange: vi.fn() };

// Only native views and SDK transport are replaced. These tests cover callbacks, not native appearance.
vi.mock('react-native', () => ({
    StyleSheet: { create: (styles: unknown) => styles },
    Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
    useWindowDimensions: () => ({ width: 440, height: 956, fontScale: 1 }),
    Modal: ({ visible, children }: { visible: boolean; children?: ReactNode }) =>
        visible ? createElement('div', null, children) : null,
    KeyboardAvoidingView: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
    ScrollView: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
    View: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
        createElement('div', { 'data-testid': testID }, children),
    Text: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
        createElement('span', { 'data-testid': testID }, children),
    ActivityIndicator: ({ testID }: { testID: string }) => createElement('span', { 'data-testid': testID }),
    Pressable: ({
        onPress,
        testID,
        disabled,
        children,
    }: {
        onPress: () => void;
        testID: string;
        disabled?: boolean;
        children?: ReactNode;
    }) => createElement('button', { onClick: onPress, 'data-testid': testID, disabled }, children),
}));
vi.mock('react-native-svg', () => ({ default: () => null, Path: () => null, Rect: () => null }));
vi.mock('expo-router', () => ({
    useFocusEffect: (effect: () => void | (() => void)) => {
        const isFocused = focused;
        useEffect(() => (isFocused ? effect() : undefined), [effect, isFocused]);
    },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('../../session/session-context', () => ({
    useSession: () => ({ login: mocks.login, refreshUser: mocks.refreshUser }),
}));
vi.mock('../../api', () => ({ ApiError: class extends Error {}, getErrorMessage: (error: Error) => error.message }));
vi.mock('../../session/auth.service', () => ({
    AuthService: { connectApple: mocks.connect, connectGoogle: mocks.connectGoogle, signInMethods: mocks.connection },
}));
vi.mock('./apple-sign-in', () => ({ AppleSignIn }));
// Only Google's credential transport is replaced; the real connection component and dialog run below.
vi.mock('./google-button', () => ({
    GoogleButton: ({ disabled, onCredential }: { disabled: boolean; onCredential: (token: string) => Promise<void> }) =>
        createElement('button', {
            disabled,
            'data-testid': 'google-sign-in',
            onClick: () => void onCredential('google-token'),
        }),
}));
vi.mock('expo-apple-authentication', () => ({
    isAvailableAsync: async () => true,
    signInAsync: mocks.signIn,
    AppleAuthenticationScope: { EMAIL: 0 },
}));

async function render(connect = false, disabled = false) {
    await act(async () => {
        root.render(createElement(AppleSignIn, { ...props, connect, disabled, rememberMe: true }));
        await vi.dynamicImportSettled();
    });
}

async function press(testID = 'apple-sign-in') {
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="${testID}"]`)!.click());
}

async function openMethods() {
    await act(async () =>
        root.render(createElement(SignInMethods, { disabled: false, onBusyChange: props.onBusyChange })),
    );
    await press('settings-sign-in-methods');
    await act(async () => {
        await vi.dynamicImportSettled();
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubEnv('EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED', 'true');
    vi.stubEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'test.apps.googleusercontent.com');
    changeSession();
    focused = true;
    container = document.createElement('div');
    root = createRoot(container);
    mocks.signIn.mockImplementation(async ({ state }: AppleAuthenticationSignInOptions) => ({
        state,
        authorizationCode: 'apple-code',
    }));
    mocks.login.mockResolvedValue({ success: true });
    mocks.connection.mockResolvedValue({ success: true, data: { google: false, apple: false } });
    mocks.connect.mockResolvedValue({ success: true });
    mocks.connectGoogle.mockResolvedValue({ success: true });
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
});

it('opens and dismisses sign-in methods without starting Apple authorization', async () => {
    await openMethods();
    expect(container.querySelector('[data-testid="apple-sign-in"]')).not.toBeNull();
    await press('sign-in-methods-done');
    expect(container.querySelector('[data-testid="sign-in-methods-dialog"]')).toBeNull();
    expect(mocks.signIn).not.toHaveBeenCalled();
});

it.each(['apple', 'google'])(
    'keeps a failed %s connection open, then shows connected only after a successful retry',
    async (provider) => {
        const connect = provider === 'apple' ? mocks.connect : mocks.connectGoogle;
        connect.mockResolvedValueOnce({ success: false, message: 'This account is already in use.' });
        await openMethods();
        await press(`${provider}-sign-in`);
        expect(container.querySelector('[data-testid="sign-in-methods-error"]')).not.toBeNull();
        expect(container.querySelector(`[data-testid="${provider}-connected"]`)).toBeNull();
        await press(`${provider}-sign-in`);
        expect(container.querySelector(`[data-testid="${provider}-connected"]`)).not.toBeNull();
        expect(container.querySelector(`[data-testid="${provider}-sign-in"]`)).toBeNull();
        expect(mocks.login).not.toHaveBeenCalled();
        if (provider === 'google') expect(connect).toHaveBeenLastCalledWith({ idToken: 'google-token' });
    },
);

it('shows existing connections without offering to link them again', async () => {
    mocks.connection.mockResolvedValue({ success: true, data: { google: true, apple: true } });
    await openMethods();
    for (const provider of ['google', 'apple']) {
        expect(container.querySelector(`[data-testid="${provider}-connected"]`)).not.toBeNull();
        expect(container.querySelector(`[data-testid="${provider}-sign-in"]`)).toBeNull();
    }
});

it('does not treat a status request failure as disconnected, and can retry loading', async () => {
    mocks.connection.mockRejectedValueOnce(new Error('Offline'));
    await openMethods();
    expect(container.querySelector('[data-testid="google-sign-in"]')).toBeNull();
    expect(container.querySelector('[data-testid="apple-sign-in"]')).toBeNull();
    await press('sign-in-methods-retry');
    await act(async () => {
        await vi.dynamicImportSettled();
    });
    expect(container.querySelector('[data-testid="google-sign-in"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="apple-sign-in"]')).not.toBeNull();
});

it('blocks other actions during connection and ignores a result after the account changes', async () => {
    let finish!: (value: unknown) => void;
    mocks.connectGoogle.mockReturnValue(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    await openMethods();
    await press('google-sign-in');
    for (const testID of ['sign-in-methods-done', 'apple-sign-in']) {
        expect(container.querySelector<HTMLButtonElement>(`[data-testid="${testID}"]`)!.disabled).toBe(true);
    }
    changeSession('another-user');
    await act(async () => finish({ success: true }));
    expect(container.querySelector('[data-testid="google-connected"]')).toBeNull();
    expect(mocks.refreshUser).not.toHaveBeenCalled();
});
