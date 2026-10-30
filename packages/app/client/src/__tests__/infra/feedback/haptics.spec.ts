import { expect, it, vi } from 'vitest';

const { storage, impactAsync } = vi.hoisted(() => ({
    storage: new Map<string, string>(),
    impactAsync: vi.fn(async () => undefined),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async (key: string) => storage.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            storage.set(key, value);
        },
    },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-haptics', () => ({ impactAsync, ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' } }));

// A fresh module import is a new app launch.
async function launch() {
    vi.resetModules();
    const haptics = await import('../../../infra/feedback/haptics');
    await haptics.loadHapticsSetting();
    return haptics;
}

it('keeps haptics off after a relaunch when a person turns them off', async () => {
    let haptics = await launch();
    haptics.hapticFeedback();
    expect(impactAsync).toHaveBeenCalledOnce();

    haptics.setHapticsEnabled(false);
    haptics = await launch();
    haptics.hapticFeedback();
    expect(impactAsync).toHaveBeenCalledOnce();
    expect(haptics.hapticsEnabled()).toBe(false);
});
