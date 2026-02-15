import { defineConfig } from 'cypress';

export default defineConfig({
    e2e: {
        videosFolder: 'tests/e2e/videos',
        screenshotsFolder: 'tests/e2e/screenshots',
        supportFile: 'tests/e2e/support/e2e.{js,jsx,ts,tsx}',
        specPattern: 'tests/e2e/specs/**/*.cy.{js,jsx,ts,tsx}',
        baseUrl: 'http://localhost:8100',
        includeShadowDom: true,

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        setupNodeEvents(on, config) {
            // implement node event listeners here
        },
    },
});
