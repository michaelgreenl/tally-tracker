import { OK, CREATED } from '../support/status-codes';
import { buildCounter } from '../fixtures/counter.fixture';

describe('Counters', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
    });

    describe('Authenticated User', () => {
        beforeEach(() => {
            cy.login('alice@example.com', 'password123');
        });

        it('should display existing counters', () => {
            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: {
                    success: true,
                    data: { counters: [buildCounter({ title: 'Push Ups' }), buildCounter({ title: 'Water Glasses' })] },
                },
            }).as('getCounters');

            cy.visit('/home');
            cy.wait('@getCounters');

            cy.contains('Push Ups').should('be.visible');
            cy.contains('Water Glasses').should('be.visible');
        });

        it('should create a new counter', () => {
            cy.intercept('POST', '/counters', {
                statusCode: CREATED,
                body: {
                    success: true,
                    data: { counter: buildCounter({ title: 'New Counter' }) },
                },
            }).as('createCounter');

            cy.contains('ion-button:visible', 'Add counter').click();
            cy.contains('h1', 'Create Counter').should('be.visible');

            cy.get('form input[type="text"]').type('New Counter');
            cy.get('[data-testid="counter-form-submit"]').click();

            cy.contains('New Counter').should('be.visible');
        });

        it('should increment a counter optimistically', () => {
            const counter = buildCounter({ count: 5 });

            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: {
                    success: true,
                    data: { counters: [counter] },
                },
            }).as('getCounters');

            cy.intercept('PUT', '/counters/increment/*', {
                statusCode: OK,
                body: {
                    success: true,
                    data: {
                        counter: { ...counter, count: 6 },
                    },
                },
            }).as('increment');

            cy.visit('/home');
            cy.wait('@getCounters');

            cy.contains('5').should('be.visible');
            cy.contains('ion-button:visible', '+1').click();
            cy.contains('6').should('be.visible');
        });

        it('should decrement a counter optimistically', () => {
            const counter = buildCounter({ count: 5 });

            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: {
                    success: true,
                    data: { counters: [counter] },
                },
            }).as('getCounters');

            cy.intercept('PUT', '/counters/increment/*', {
                statusCode: OK,
                body: {
                    success: true,
                    data: {
                        counter: { ...counter, count: 4 },
                    },
                },
            }).as('decrement');

            cy.visit('/home');
            cy.wait('@getCounters');

            cy.contains('ion-button:visible', '-1').click();
            cy.contains('4').should('be.visible');
        });

        it('should delete a counter', () => {
            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: {
                    success: true,
                    data: {
                        counters: [buildCounter({ title: 'Delete Me' })],
                    },
                },
            }).as('getCounters');

            cy.intercept('DELETE', '/counters/*', {
                statusCode: OK,
                body: { success: true },
            }).as('deleteCounter');

            cy.visit('/home');
            cy.wait('@getCounters');

            cy.contains('Delete Me').should('be.visible');
            cy.contains('ion-button:visible', 'delete').click();

            cy.contains('Delete Me').should('not.exist');
        });
    });

    describe('Guest User', () => {
        beforeEach(() => {
            cy.loginAsGuest();
        });

        it('should allow creating counters as guest', () => {
            cy.url().should('include', '/home');

            cy.contains('ion-button:visible', 'Add counter').click();
            cy.contains('h1', 'Create Counter').should('be.visible');

            cy.get('form input[type="text"]').type('Guest Counter');
            cy.get('[data-testid="counter-form-submit"]').click();

            cy.contains('Guest Counter').should('be.visible');
        });

        it('should persist counters locally', () => {
            cy.url().should('include', '/home');

            cy.contains('ion-button:visible', 'Add counter').click();
            cy.contains('h1', 'Create Counter').should('be.visible');

            cy.get('form input[type="text"]').type('Persistent Counter');
            cy.get('[data-testid="counter-form-submit"]').click();

            cy.contains('Persistent Counter').should('be.visible');

            cy.reload();

            cy.contains('Persistent Counter').should('be.visible');
        });
    });
});
