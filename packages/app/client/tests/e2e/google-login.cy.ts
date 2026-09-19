/// <reference types="cypress" />

// Stub only Google's external SDK and API responses. Exercise real buttons, dialogs, session state, and routing.
const googleScript = `
window.google = { accounts: { id: {
    initialize({ callback }) { window.googleCredential = callback; },
    renderButton(container) {
        const button = document.createElement('button');
        button.dataset.testid = 'google-provider-button';
        button.textContent = 'Continue with Google';
        button.onclick = () => window.googleCredential({ credential: 'provider-id-token' });
        container.replaceChildren(button);
    }
} } };
`;
const user = { id: 'google-account', email: 'person@gmail.com', tier: 'BASIC', emailVerified: true };

describe('Google sign-in', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
        cy.intercept('GET', 'https://accounts.google.com/gsi/client*', {
            headers: { 'content-type': 'application/javascript' },
            body: googleScript,
        });
        cy.intercept('GET', '**/counters', { body: { success: true, data: { counters: [] } } });
        cy.intercept('GET', '**/users/check-auth', { body: { success: true, data: { user } } });
    });

    it('requires password confirmation to link, supports cancel/retry, and resumes the shared invitation', () => {
        const inviteCode = crypto.randomUUID();
        cy.intercept('POST', '**/users/google', (req) => {
            if (!req.body.password)
                req.reply({ statusCode: 409, body: { success: false, code: 'GOOGLE_LINK_REQUIRED' } });
            else if (req.body.password !== 'Correct-password1')
                req.reply({ statusCode: 401, body: { success: false, message: 'Incorrect password.' } });
            else req.reply({ body: { success: true, data: { user } } });
        }).as('googleLogin');
        cy.intercept('POST', '**/counters/join', {
            body: {
                success: true,
                data: {
                    counter: {
                        id: 'joined',
                        userId: 'owner',
                        title: 'Water',
                        count: 0,
                        increment: 1,
                        type: 'SHARED',
                        inviteCode,
                    },
                },
            },
        }).as('join');
        cy.visit(`/login?inviteCode=${inviteCode}`);
        cy.get('[data-testid="auth-remember-me"]').click();
        cy.get('[data-testid="google-provider-button"]').click();
        cy.wait('@googleLogin')
            .its('request.body')
            .should('deep.equal', { idToken: 'provider-id-token', rememberMe: true });
        cy.get('[data-testid="auth-submit-loading"]').should('not.exist');
        cy.get('[data-testid="google-sign-in-loading"]').should('not.exist');
        cy.get('[data-testid="google-link-password"]').type('Do-not-keep1');
        cy.get('[data-testid="google-link-cancel"]').click();
        cy.get('[data-testid="google-link-dialog"]').should('not.exist');
        cy.get('@googleLogin.all').should('have.length', 1);
        cy.get('[data-testid="google-provider-button"]').click();
        cy.wait('@googleLogin');
        cy.get('[data-testid="google-link-password"]').should('have.value', '').type('Wrong-password1');
        cy.get('[data-testid="google-link-submit"]').click();
        cy.wait('@googleLogin').its('response.statusCode').should('eq', 401);
        cy.location('pathname').should('eq', '/login');
        cy.get('[data-testid="google-link-dialog"]').should('be.visible');
        cy.get('[data-testid="google-link-password"]').clear().type('Correct-password1');
        cy.get('[data-testid="google-link-submit"]').click();
        cy.wait('@googleLogin');
        cy.wait('@join').its('request.body').should('deep.equal', { inviteCode });
        cy.location('pathname').should('eq', '/home');
        cy.window().then((win) => {
            expect(JSON.parse(win.localStorage.getItem('auth_user_profile')!)).to.deep.equal(user);
            expect(JSON.stringify(win.localStorage)).not.to.contain('provider-id-token');
        });
    });

    it('allows Google registration without filling the password form', () => {
        cy.intercept('POST', '**/users/google', { body: { success: true, data: { user } } }).as('googleLogin');
        cy.visit('/register');
        cy.get('[data-testid="google-provider-button"]').click();
        cy.wait('@googleLogin');
        cy.location('pathname').should('eq', '/home');
    });

    it('shows only Google progress while its request is pending and restores both actions after failure', () => {
        let finish!: () => void;
        const response = new Cypress.Promise<void>((resolve) => {
            finish = resolve;
        });
        cy.intercept('POST', '**/users/google', (req) =>
            response.then(() => req.reply({ statusCode: 401, body: { success: false } })),
        ).as('googleLogin');
        cy.visit('/login');
        cy.get('[data-testid="google-provider-button"]').click();
        cy.get('[data-testid="google-sign-in-loading"]').should('be.visible');
        cy.get('[data-testid="auth-submit"]').should('be.disabled');
        cy.get('[data-testid="auth-submit-loading"]')
            .should('not.exist')
            .then(() => finish());
        cy.wait('@googleLogin');
        cy.get('[data-testid="google-sign-in-loading"]').should('not.exist');
        cy.get('[data-testid="auth-submit"]').should('not.be.disabled');
        cy.get('[data-testid="google-provider-button"]').should('be.visible').focus().should('have.focus');
    });

    it('returns the Google callback to login after navigating back from registration', () => {
        cy.intercept('POST', '**/users/google', { body: { success: true, data: { user } } }).as('googleLogin');
        cy.visit('/login');
        cy.get('[data-testid="auth-switch-mode"]').click();
        cy.get('[data-testid="google-provider-button"]').should('be.visible');
        cy.get('[data-testid="auth-register-back"]').click();
        cy.location('pathname').should('eq', '/login');
        cy.get('[data-testid="google-provider-button"]').should('have.length', 1).click();
        cy.wait('@googleLogin');
        cy.location('pathname').should('eq', '/home');
    });

    it('ignores a delayed provider callback after leaving authentication', () => {
        cy.intercept('POST', '**/users/google', { statusCode: 401, body: { success: false } }).as('googleLogin');
        cy.visit('/login');
        cy.get('[data-testid="google-provider-button"]').should('be.visible');
        cy.get('[data-testid="continue-as-guest"]').click();
        cy.location('pathname').should('eq', '/home');
        cy.window().then((win) => {
            (win as unknown as { googleCredential: (response: { credential: string }) => void }).googleCredential({
                credential: 'late-token',
            });
        });
        cy.get('@googleLogin.all').should('have.length', 0);
    });

    it('does not race a pending password login with a late Google popup result', () => {
        let finish!: () => void;
        const response = new Cypress.Promise<void>((resolve) => {
            finish = resolve;
        });
        cy.intercept('POST', '**/users/login', (req) =>
            response.then(() => req.reply({ body: { success: true, data: { user } } })),
        ).as('passwordLogin');
        cy.intercept('POST', '**/users/google', { statusCode: 401, body: { success: false } }).as('googleLogin');
        cy.visit('/login');
        cy.get('[data-testid="google-provider-button"]').should('be.visible');
        cy.get('[data-testid="auth-email"]').type('person@gmail.com');
        cy.get('[data-testid="auth-password"]').type('Existing-password1');
        cy.get('[data-testid="auth-submit"]').click().should('be.disabled');
        cy.get('[data-testid="auth-submit-loading"]').should('be.visible');
        cy.get('[data-testid="google-sign-in-loading"]').should('not.exist');
        cy.get('[data-testid="google-provider-button"]').should('be.visible').focus().should('not.have.focus');
        cy.window().then((win) => {
            (win as unknown as { googleCredential: (response: { credential: string }) => void }).googleCredential({
                credential: 'late-token',
            });
        });
        cy.get('@googleLogin.all')
            .should('have.length', 0)
            .then(() => finish());
        cy.wait('@passwordLogin');
        cy.location('pathname').should('eq', '/home');
    });
});
