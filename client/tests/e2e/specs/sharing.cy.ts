import { OK, CREATED, NOT_FOUND } from '../support/status-codes';
import { buildCounter, buildSharedCounter } from '../fixtures/counter.fixture';
import { buildClientUser } from '../fixtures/user.fixture';

describe('Counter Sharing', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
    });

    describe('Join Shared Counter', () => {
        it('should join a shared counter via invite link', () => {
            cy.login('alice@example.com', 'password123');

            cy.intercept('POST', '/counters/join', {
                statusCode: CREATED,
                body: {
                    success: true,
                    data: {
                        counter: buildSharedCounter({ title: 'Shared Counter' }),
                    },
                },
            }).as('joinCounter');

            cy.visit('/join?code=ABC123');

            cy.wait('@joinCounter');
            cy.url().should('include', '/home');
            cy.contains('Shared Counter').should('be.visible');
        });

        it('should show error for invalid invite code', () => {
            cy.login('alice@example.com', 'password123');

            cy.intercept('POST', '/counters/join', {
                statusCode: NOT_FOUND,
                body: {
                    success: false,
                    message: 'Invalid or expired invite link',
                },
            }).as('joinCounter');

            cy.visit('/join?code=INVALID');

            cy.wait('@joinCounter');
            cy.on('window:alert', (text) => {
                expect(text).to.contains('Failed to join');
            });
        });

        it('should require authentication to join', () => {
            cy.visit('/join?code=ABC123');
        });
    });

    describe('Share Counter', () => {
        it('should show share button only for shared counters', () => {
            cy.login('alice@example.com', 'password123');

            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: {
                    success: true,
                    data: {
                        counters: [buildCounter({ title: 'Personal' }), buildSharedCounter({ title: 'Shared' })],
                    },
                },
            }).as('getCounters');

            cy.visit('/home');
            cy.wait('@getCounters');

            cy.contains('Personal')
                .parents('.counter-wrapper')
                .within(() => {
                    cy.contains('Share').should('not.exist');
                });

            cy.contains('Shared')
                .parents('.counter-wrapper')
                .within(() => {
                    cy.contains('Share').should('be.visible');
                });
        });

        it('should copy share link to clipboard', () => {
            cy.login('alice@example.com', 'password123');

            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: {
                    success: true,
                    data: {
                        counters: [buildSharedCounter({ title: 'Shared Counter' })],
                    },
                },
            }).as('getCounters');

            cy.visit('/home');
            cy.wait('@getCounters');

            cy.window().then((win) => {
                cy.stub(win.navigator.clipboard, 'writeText').resolves();
            });

            cy.contains('ion-button', 'Share').click();

            cy.on('window:alert', (text) => {
                expect(text).to.contains('copied');
            });
        });
    });

    describe('Premium Features', () => {
        it('should disable sharing toggle for basic users', () => {
            cy.intercept('POST', '/users/login', {
                statusCode: OK,
                body: {
                    success: true,
                    data: {
                        user: buildClientUser(),
                        accessToken: 'token',
                    },
                },
            }).as('login');

            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: { success: true, data: { counters: [] } },
            }).as('getCounters');

            cy.login('alice@example.com', 'password123');

            cy.wait('@login');
            cy.wait('@getCounters');

            cy.contains('ion-button', 'Add counter').click();

            cy.get('form').should('be.visible');
            cy.get('ion-toggle').should('have.class', 'toggle-disabled');
            cy.contains('Premium Feature').should('be.visible');
        });

        it('should enable sharing toggle for premium users', () => {
            cy.intercept('POST', '/users/login', {
                statusCode: OK,
                body: {
                    success: true,
                    data: {
                        user: buildClientUser({ tier: 'PREMIUM' }),
                        accessToken: 'token',
                    },
                },
            }).as('login');

            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: { success: true, data: { counters: [] } },
            }).as('getCounters');

            cy.login('alice@example.com', 'password123');

            cy.wait('@login');
            cy.wait('@getCounters');

            cy.url().should('include', '/home');
            cy.get('.ion-page:not(.ion-page-hidden)').should('be.visible');

            cy.get('.ion-page:not(.ion-page-hidden)').contains('ion-button', 'Add counter').click();

            cy.get('form').should('be.visible');
            cy.get('ion-toggle').should('not.have.class', 'toggle-disabled');
        });
    });
});
