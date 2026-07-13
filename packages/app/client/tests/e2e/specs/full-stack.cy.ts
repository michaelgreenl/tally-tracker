import { CREATED, OK } from '../support/status-codes';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const submitLogin = (email: string, password: string) => {
    cy.contains('h1:visible', /^Welcome to Tally Tracker$/)
        .closest('.ion-page')
        .should('be.visible')
        .find('form')
        .within(() => {
            cy.get('input[type="email"]').clear().type(email);
            cy.get('input[type="password"]').clear().type(password);
            cy.contains('ion-button', 'Login').click();
        });
};

describe('Full-stack counter journey', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
    });

    it('persists a real personal counter across sessions and deletes the account', () => {
        const suffix = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
        const email = `cypress-${suffix}@example.com`;
        const password = 'password123';
        const title = `E2E ${suffix}`;
        let counterId = '';

        cy.intercept('POST', '/users').as('registerUser');
        cy.intercept('POST', '/users/login').as('loginUser');
        cy.intercept('GET', '/counters').as('getCounters');
        cy.intercept('POST', '/counters').as('createCounter');
        cy.intercept('PUT', '/counters/*/count').as('setCounterCount');
        cy.intercept('POST', '/users/logout').as('logoutUser');
        cy.intercept('DELETE', '/users').as('deleteAccount');

        cy.visit('/register');
        cy.contains('h1', 'Create Account').closest('.ion-page').should('be.visible').as('registerPage');

        cy.get('@registerPage').within(() => {
            cy.get('input[type="email"]').type(email);
            cy.get('input[type="password"]').first().type(password);
            cy.get('input[type="password"]').last().type(password);
            cy.contains('ion-button', 'Register').click();
        });

        cy.wait('@registerUser').then(({ request, response }) => {
            expect(request.method).to.eq('POST');
            expect(request.body).to.deep.equal({ email, password });
            expect(response?.statusCode).to.eq(CREATED);
        });
        cy.location('pathname').should('eq', '/login');

        submitLogin(email, password);

        cy.wait('@loginUser').then(({ request, response }) => {
            expect(request.method).to.eq('POST');
            expect(request.body).to.deep.equal({ email, password, rememberMe: false });
            expect(response?.statusCode).to.eq(OK);
        });
        cy.wait('@getCounters').then(({ response }) => {
            expect(response?.statusCode).to.eq(OK);
            expect(response?.body?.data?.counters).to.deep.equal([]);
        });
        cy.location('pathname').should('eq', '/home');

        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="home-counter-form"]').within(() => {
            cy.get('input[type="text"]').type(title);
            cy.get('[data-testid="counter-form-submit"]').click();
        });

        cy.wait('@createCounter').then(({ request, response }) => {
            counterId = request.body.id;

            expect(request.method).to.eq('POST');
            expect(counterId).to.match(UUID_V4_PATTERN);
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
            expect(response?.body?.data?.counter).to.include({ id: counterId, title, count: 0 });
        });
        cy.contains('.counter-wrapper', title).should('be.visible').as('counterCard');

        cy.get('@counterCard').contains('ion-button', '+1').click();

        cy.wait('@setCounterCount').then(({ request, response }) => {
            expect(request.method).to.eq('PUT');
            expect(new URL(request.url).pathname).to.eq(`/counters/${counterId}/count`);
            expect(request.body).to.deep.equal({ count: 1 });
            expect(request.headers['x-idempotency-key']).to.be.a('string').and.not.be.empty;
            expect(response?.statusCode).to.eq(OK);
            expect(response?.body?.data?.counter).to.include({ id: counterId, title, count: 1 });
        });
        cy.get('@counterCard').contains('h3', '1').should('be.visible');

        cy.get('.ion-page:not(.ion-page-hidden)').contains('ion-button', 'Logout').click();
        cy.wait('@logoutUser').then(({ request, response }) => {
            expect(request.method).to.eq('POST');
            expect(response?.statusCode).to.eq(OK);
        });
        cy.location('pathname').should('eq', '/login');

        submitLogin(email, password);

        cy.wait('@loginUser').its('response.statusCode').should('eq', OK);
        cy.wait('@getCounters').then(({ response }) => {
            expect(response?.statusCode).to.eq(OK);

            const counters = response?.body?.data?.counters as Array<{ id: string; title: string; count: number }>;
            expect(counters).to.be.an('array');
            expect(counters.find((counter) => counter.id === counterId)).to.include({
                id: counterId,
                title,
                count: 1,
            });
        });

        cy.contains('.counter-wrapper', title).within(() => {
            cy.contains('h3', '1').should('be.visible');
        });

        cy.get('[data-testid="home-settings-link"]').click();
        cy.location('pathname').should('eq', '/settings');
        cy.get('[data-testid="settings-delete-account"]').click();
        cy.get('[data-testid="delete-account-confirm"]')
            .should('be.visible')
            .within(() => {
                cy.contains('ion-button', 'Delete account').click();
            });

        cy.wait('@deleteAccount').then(({ request, response }) => {
            expect(request.method).to.eq('DELETE');
            expect(response?.statusCode).to.eq(OK);
        });
        cy.location('pathname').should('eq', '/login');
        cy.getCookie('access_token').should('not.exist');
        cy.window().then((win) => {
            expect(win.localStorage.getItem('AUTHORIZED')).to.be.null;
        });
    });
});
