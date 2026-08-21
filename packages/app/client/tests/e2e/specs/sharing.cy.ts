import { OK, CREATED, NOT_FOUND } from '../support/status-codes';
import { buildCounter, buildSharedCounter } from '../fixtures/counter.fixture';
import { buildClientUser } from '../fixtures/user.fixture';

const authRes = (user: ReturnType<typeof buildClientUser>) => ({
    statusCode: OK,
    body: {
        success: true,
        data: { user, accessToken: 'token' },
    },
});

const loginWithStubbedCounters = (
    user: ReturnType<typeof buildClientUser>,
    counters: ReturnType<typeof buildCounter>[] = [],
) => {
    cy.intercept('POST', '/users/login', authRes(user));
    cy.intercept('GET', '/users/check-auth', authRes(user));
    cy.intercept('GET', '/counters', {
        statusCode: OK,
        body: { success: true, data: { counters } },
    }).as('getCounters');

    cy.login(user.email, 'password123');
    cy.wait('@getCounters').its('response.statusCode').should('eq', OK);
};

describe('Counter Sharing', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
    });

    describe('Join Shared Counter', () => {
        it('joins a shared counter from an invite link', () => {
            const user = buildClientUser({ email: 'alice@example.com', tier: 'PREMIUM' });
            const owner = buildClientUser({ email: 'owner@example.com', tier: 'PREMIUM' });
            loginWithStubbedCounters(user);

            cy.intercept('POST', '/counters/join', {
                statusCode: CREATED,
                body: {
                    success: true,
                    data: {
                        counter: buildSharedCounter({ title: 'Shared Counter', userId: owner.id }),
                    },
                },
            }).as('joinCounter');

            cy.visit('/join?code=ABC123', {
                onBeforeLoad(win) {
                    cy.stub(win, 'alert').as('alert');
                },
            });

            cy.wait('@joinCounter').then(({ request, response }) => {
                expect(request.body).to.deep.equal({ inviteCode: 'ABC123' });
                expect(response?.statusCode).to.eq(CREATED);
            });
            cy.get('@alert').should('have.been.calledOnceWithExactly', 'Counter accepted!');
            cy.url().should('include', '/home');
            cy.contains('Shared Counter').should('be.visible');
        });

        it('reports an invalid invite code', () => {
            const user = buildClientUser({ email: 'alice@example.com', tier: 'PREMIUM' });
            loginWithStubbedCounters(user);

            cy.intercept('POST', '/counters/join', {
                statusCode: NOT_FOUND,
                body: {
                    success: false,
                    message: 'Invalid or expired invite link',
                },
            }).as('joinCounter');

            cy.visit('/join?code=INVALID', {
                onBeforeLoad(win) {
                    cy.stub(win, 'alert').as('alert');
                },
            });

            cy.wait('@joinCounter').then(({ request, response }) => {
                expect(request.body).to.deep.equal({ inviteCode: 'INVALID' });
                expect(response?.statusCode).to.eq(NOT_FOUND);
            });
            cy.get('@alert').should(
                'have.been.calledOnceWithExactly',
                'Failed to join: Invalid or expired invite link',
            );
            cy.url().should('include', '/home');
        });
    });

    describe('Share Counter', () => {
        it('should show share button only for shared counters', () => {
            const user = buildClientUser({ email: 'alice@example.com', tier: 'PREMIUM' });
            loginWithStubbedCounters(user, [
                buildCounter({ title: 'Personal', userId: user.id }),
                buildSharedCounter({ title: 'Shared', userId: user.id }),
            ]);

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

        it('copies the exact share URL and confirms it', () => {
            const user = buildClientUser({ email: 'alice@example.com', tier: 'PREMIUM' });
            const inviteCode = 'ABC12345';
            loginWithStubbedCounters(user, [
                buildSharedCounter({ title: 'Shared Counter', inviteCode, userId: user.id }),
            ]);

            cy.window().then((win) => {
                const writeText = cy.stub(win.navigator.clipboard, 'writeText').resolves();
                cy.wrap(writeText).as('writeText');
                cy.stub(win, 'alert').as('alert');
            });

            cy.contains('ion-button', 'Share').click();

            const baseUrl = Cypress.config('baseUrl');
            if (typeof baseUrl !== 'string') throw new Error('Cypress baseUrl must be configured');

            const expectedUrl = new URL(`/join?code=${inviteCode}`, baseUrl).href;
            cy.get('@writeText').should('have.been.calledOnceWithExactly', expectedUrl);
            cy.get('@alert').should('have.been.calledOnceWithExactly', 'Share Link copied to clipboard!');
        });
    });

    describe('Premium Features', () => {
        it('should disable sharing toggle for basic users', () => {
            const user = buildClientUser({ email: 'alice@example.com', tier: 'BASIC' });
            loginWithStubbedCounters(user);

            cy.contains('ion-button', 'Add counter').click();

            cy.get('[data-testid="home-counter-form"]')
                .should('be.visible')
                .within(() => {
                    cy.get('ion-toggle').should('have.class', 'toggle-disabled');
                    cy.contains('Premium Feature').should('be.visible');
                });
        });

        it('should enable sharing toggle for premium users', () => {
            const user = buildClientUser({ email: 'alice@example.com', tier: 'PREMIUM' });
            loginWithStubbedCounters(user);

            cy.url().should('include', '/home');
            cy.get('.ion-page:not(.ion-page-hidden)').should('be.visible');

            cy.get('.ion-page:not(.ion-page-hidden)').contains('ion-button', 'Add counter').click();

            cy.get('[data-testid="home-counter-form"]')
                .should('be.visible')
                .within(() => {
                    cy.get('ion-toggle').should('not.have.class', 'toggle-disabled');
                });
        });
    });
});
