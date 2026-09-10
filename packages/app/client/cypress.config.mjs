import { defineConfig } from 'cypress';

export default defineConfig({
    video: false,
    e2e: {
        baseUrl: 'http://localhost:8081',
        specPattern: 'tests/e2e/**/*.cy.ts',
        supportFile: false,
        setupNodeEvents(on) {
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
