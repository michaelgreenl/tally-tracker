/// <reference types="cypress" />

const PASSWORD = 'Password123';
const OK = 200;
const CREATED = 201;

describe('Expo full-stack counter journey', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
    });

    it('persists a counter across sessions and deletes the account', () => {
        const suffix = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
        const email = `expo-cypress-${suffix}@example.com`;
        const title = `Expo E2E ${suffix}`;
        let counterId = '';

        cy.intercept('POST', '**/users').as('registerUser');
        cy.visit('/register');
        cy.get('[data-testid="auth-email"]').type(email);
        cy.get('[data-testid="auth-password"]').type(PASSWORD);
        cy.get('[data-testid="auth-confirm-password"]').type(PASSWORD);
        cy.get('[data-testid="auth-submit"]').click();

        cy.wait('@registerUser').then(({ request, response }) => {
            expect(request.body).to.deep.equal({ email, password: PASSWORD });
            expect(response?.statusCode).to.eq(CREATED);
        });
        cy.location('pathname').should('eq', '/verify-email');
        cy.get('[data-testid="email-auth-login"]').click();
        cy.location('pathname').should('eq', '/login');

        cy.intercept('POST', '**/users/login').as('loginUser');
        cy.intercept('GET', '**/counters').as('getCounters');
        cy.get('[data-testid="auth-email"]').should('have.value', email);
        cy.get('[data-testid="auth-password"]').type(PASSWORD);
        cy.get('[data-testid="auth-submit"]').click();

        cy.wait('@loginUser').then(({ request, response }) => {
            expect(request.body).to.deep.equal({ email, password: PASSWORD, rememberMe: false });
            expect(response?.statusCode).to.eq(OK);
        });
        cy.wait('@getCounters').then(({ request, response }) => {
            expect(new URL(request.url).origin).to.eq(new URL(Cypress.config('baseUrl')!).origin);
            expect(request.headers.cookie).to.include('access_token=');
            expect(response?.statusCode).to.eq(OK);
        });
        cy.location('pathname').should('eq', '/home');

        cy.intercept('POST', '**/counters').as('createCounter');
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-title"]').type(title);
        cy.get('[data-testid="counter-form-submit"]').click();

        cy.wait('@createCounter').then(({ request, response }) => {
            counterId = request.body.id;
            expect(request.body).to.deep.equal({
                id: counterId,
                title,
                color: '#000000',
                count: 0,
                metric: null,
                increment: 1,
            });
            expect(request.headers['x-idempotency-key']).to.be.a('string').and.not.be.empty;
            expect(response?.statusCode).to.eq(CREATED);
        });

        cy.then(() => {
            cy.get(`[data-testid="counter-${counterId}-menu"]`).click();
            cy.get(`[data-testid="counter-${counterId}-share"]`).should('be.disabled');
            cy.get(`[data-testid="counter-${counterId}-menu"]`).click();
        });

        cy.intercept('PUT', '**/counters/increment/*').as('incrementCounter');
        cy.then(() => {
            cy.get(`[data-testid="counter-${counterId}-increase"]`).click();
        });
        cy.wait('@incrementCounter').then(({ request, response }) => {
            expect(request.body).to.deep.equal({ amount: 1 });
            expect(request.headers['x-idempotency-key']).to.be.a('string').and.not.be.empty;
            expect(response?.statusCode).to.eq(OK);
        });
        cy.then(() => {
            cy.get(`[data-testid="counter-${counterId}-count"]`).should('have.text', '1');
        });

        // A change outside the UI must arrive through the authenticated socket.
        cy.then(() => {
            cy.request('PUT', `/counters/increment/${counterId}`, { amount: 1 });
            cy.get(`[data-testid="counter-${counterId}-count"]`).should('have.text', '2');
            cy.request('PUT', `/counters/update/${counterId}`, {
                title: `${title} edited`,
                increment: 0.5,
                metric: '16oz water bottle',
            });
            cy.get(`[data-testid="counter-${counterId}-title"]`).should('have.text', `${title} edited`);
            cy.get(`[data-testid="counter-${counterId}-increment"]`).should('have.text', '± 0.5');
            cy.get(`[data-testid="counter-${counterId}-metric"]`).should('have.text', '16oz water bottle');
        });

        let finishLogout!: () => void;
        const logoutResponse = new Cypress.Promise<void>((resolve) => {
            finishLogout = resolve;
        });
        cy.intercept('POST', '**/users/logout', (request) => logoutResponse.then(() => request.continue())).as(
            'logoutUser',
        );
        cy.get('[data-testid="home-settings-link"]').click();
        cy.get('[data-testid="settings-logout"]').click();
        cy.get('[data-testid="logout-cancel"]').click();
        cy.location('pathname').should('eq', '/settings');
        cy.get('@logoutUser.all').should('have.length', 0);
        cy.get('[data-testid="settings-logout"]').click();
        cy.get('[data-testid="logout-confirm-submit"]').click();
        cy.location('pathname').should('eq', '/login');
        cy.window().should((win) => expect(win.localStorage.getItem('auth_user_profile')).to.be.null);
        cy.then(() => finishLogout());
        cy.wait('@logoutUser').its('response.statusCode').should('eq', OK);

        cy.get('[data-testid="auth-email"]').type(email);
        cy.get('[data-testid="auth-password"]').type(PASSWORD);
        cy.get('[data-testid="auth-remember-me"]').check();
        cy.get('[data-testid="auth-submit"]').click();
        cy.wait('@loginUser').its('response.statusCode').should('eq', OK);
        cy.wait('@getCounters').its('response.statusCode').should('eq', OK);

        let refreshPhase = 'before-reload';
        cy.intercept('POST', '**/users/refresh', (request) => {
            // Do not observe requests that the old document can cancel during navigation.
            if (refreshPhase !== 'before-reload') {
                request.alias = refreshPhase === 'available' ? 'refreshSession' : 'refreshUnavailable';
            }
            if (refreshPhase === 'available') request.continue();
            else request.reply({ statusCode: 503, body: { success: false } });
        });
        cy.clearCookie('access_token');
        cy.visit('/home', {
            onBeforeLoad() {
                refreshPhase = 'unavailable';
            },
        });
        cy.wait('@refreshUnavailable').its('response.statusCode').should('eq', 503);
        cy.get('[data-testid="home-settings-link"]').click();
        cy.get('[data-testid="settings-logout"]').should('be.visible');
        cy.visit('/home', {
            onBeforeLoad() {
                refreshPhase = 'available';
            },
        });
        cy.wait('@refreshSession').then(({ request, response }) => {
            expect(request.headers.cookie).to.include('refresh_token=');
            expect(response?.statusCode).to.eq(OK);
        });
        cy.then(() => {
            cy.get(`[data-testid="counter-${counterId}-count"]`).should('have.text', '2');
        });

        cy.intercept('DELETE', '**/users').as('deleteAccount');
        cy.get('[data-testid="home-settings-link"]').click();
        cy.location('pathname').should('eq', '/settings');
        cy.get('[data-testid="settings-delete-account"]').click();
        cy.get('[data-testid="delete-account-confirm-submit"]').click();

        cy.wait('@deleteAccount').its('response.statusCode').should('eq', OK);
        cy.location('pathname').should('eq', '/login');
        cy.getCookie('access_token').should('not.exist');
    });

    it('requires Submit after the sixth verification digit', () => {
        const email = 'submit-required@example.com';

        cy.intercept('POST', /\/users\/verify-email$/, {
            statusCode: OK,
            body: { success: true },
        }).as('verifyEmail');
        cy.visit(`/verify-email?email=${encodeURIComponent(email)}`);

        cy.get('[data-testid="email-auth-code"]').type('123456');
        cy.get('@verifyEmail.all').should('have.length', 0);

        cy.get('[data-testid="email-auth-submit"]').click();
        cy.wait('@verifyEmail').its('request.body').should('deep.equal', { email, code: '123456' });
        cy.get('[data-testid="email-auth-login"]').click();
        cy.location('pathname').should('eq', '/login');
        cy.get('[data-testid="auth-email"]').should('have.value', email);
    });
});
