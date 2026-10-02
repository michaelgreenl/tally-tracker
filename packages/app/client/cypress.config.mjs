import { defineConfig } from 'cypress';

export default defineConfig({
    video: false,
    e2e: {
        baseUrl: 'http://localhost:8081',
        specPattern: 'tests/e2e/**/*.cy.ts',
        supportFile: false,
        async setupNodeEvents(on, config) {
            const isLocal = (url) =>
                url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
            if (!isLocal(new URL(config.baseUrl))) throw new Error('Cypress requires a local development site.');
            const response = await fetch(new URL('/__tally_dev__/api-origin', config.baseUrl), {
                redirect: 'error',
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok || !isLocal(new URL(await response.text()))) {
                throw new Error(
                    'Cypress requires Metro to proxy a local API. Restart Expo with EXPO_PUBLIC_API_URL=http://localhost:3000.',
                );
            }
            on('before:browser:launch', (browser, launchOptions) => {
                if (browser.family === 'chromium' && browser.name !== 'electron') {
                    launchOptions.preferences.default.profile = {
                        ...launchOptions.preferences.default.profile,
                        cookie_controls_mode: 1, // Block third-party cookies in the test profile.
                    };
                }
                return launchOptions;
            });
        },
    },
});
