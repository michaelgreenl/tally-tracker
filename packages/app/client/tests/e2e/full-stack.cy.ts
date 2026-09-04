/// <reference types="cypress" />

const PASSWORD = 'password123';
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
        cy.get('[data-testid="auth-email"]').type(email);
        cy.get('[data-testid="auth-password"]').type(PASSWORD);
        cy.get('[data-testid="auth-submit"]').click();

        cy.wait('@loginUser').then(({ request, response }) => {
            expect(request.body).to.deep.equal({ email, password: PASSWORD, rememberMe: false });
            expect(response?.statusCode).to.eq(OK);
        });
        cy.wait('@getCounters').its('response.statusCode').should('eq', OK);
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
                type: 'PERSONAL',
                inviteCode: null,
            });
            expect(request.headers['x-idempotency-key']).to.be.a('string').and.not.be.empty;
            expect(response?.statusCode).to.eq(CREATED);
        });

        cy.intercept('PUT', '**/counters/*/count').as('incrementCounter');
        cy.then(() => {
            cy.get(`[data-testid="counter-${counterId}-increase"]`).click();
        });
        cy.wait('@incrementCounter').then(({ request, response }) => {
            expect(request.body).to.deep.equal({ count: 1 });
            expect(request.headers['x-idempotency-key']).to.be.a('string').and.not.be.empty;
            expect(response?.statusCode).to.eq(OK);
        });
        cy.then(() => {
            cy.get(`[data-testid="counter-${counterId}-count"]`).should('have.text', '1');
        });

        cy.intercept('POST', '**/users/logout').as('logoutUser');
        cy.get('[data-testid="home-logout"]').click();
        cy.wait('@logoutUser').its('response.statusCode').should('eq', OK);
        cy.location('pathname').should('eq', '/login');

        cy.get('[data-testid="auth-email"]').type(email);
        cy.get('[data-testid="auth-password"]').type(PASSWORD);
        cy.get('[data-testid="auth-submit"]').click();
        cy.wait('@loginUser').its('response.statusCode').should('eq', OK);
        cy.wait('@getCounters').its('response.statusCode').should('eq', OK);
        cy.then(() => {
            cy.get(`[data-testid="counter-${counterId}-count"]`).should('have.text', '1');
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
    });
});
