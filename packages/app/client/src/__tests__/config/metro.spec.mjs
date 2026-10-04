import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const configPath = require.resolve('../../../metro.config.js');

function cacheVersion() {
    delete require.cache[configPath];
    return require(configPath).cacheVersion;
}

afterEach(() => {
    vi.unstubAllEnvs();
    delete require.cache[configPath];
});

it('invalidates cached production transforms when sign-in configuration changes', () => {
    const providers = {
        EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: 'true',
        EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com',
        EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios.apps.googleusercontent.com',
    };
    for (const key of Object.keys(providers)) vi.stubEnv(key, '');
    const disabled = cacheVersion();
    expect(cacheVersion()).toBe(disabled);

    for (const [key, value] of Object.entries(providers)) {
        vi.stubEnv(key, value);
        expect(cacheVersion(), key).not.toBe(disabled);
        vi.stubEnv(key, '');
    }
});
