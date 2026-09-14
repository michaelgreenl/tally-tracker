/// <reference types="cypress" />

describe('Counter actions', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
    });

    it('keeps guest sharing disabled while edit and delete work through the menu', () => {
        cy.visit('/home');
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-title"]').type('Menu counter');
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.get('[data-testid^="counter-"][data-testid$="-menu"]').click();
        cy.get('[data-testid^="counter-"][data-testid$="-share"]').should('be.visible').and('be.disabled');
        cy.get('[data-testid^="counter-"][data-testid$="-edit"]').click();
        cy.get('[data-testid="counter-title"]').clear().type('Edited counter');
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.get('[data-testid^="counter-"][data-testid$="-menu"]')
            .should('have.attr', 'aria-label', 'Actions for Edited counter')
            .click();
        cy.get('[data-testid^="counter-"][data-testid$="-delete"]').click();
        cy.get('[data-testid="counter-list"]').should('not.exist');
        cy.reload();
        cy.get('[data-testid="counter-list"]').should('not.exist');
    });

    it('shows sharing failures and copies a server-issued invite for a premium counter', () => {
        const counter = {
            id: crypto.randomUUID(),
            userId: 'premium-user',
            title: 'Existing counter',
            count: 3,
            type: 'PERSONAL',
            inviteCode: null,
            color: '#000000',
        };
        cy.intercept('POST', '**/users/login', {
            body: {
                success: true,
                data: {
                    user: { id: counter.userId, email: 'premium@example.com', tier: 'PREMIUM', emailVerified: true },
                },
            },
        });
        cy.intercept('GET', '**/counters', { body: { success: true, data: { counters: [counter] } } });
        cy.intercept('POST', `**/counters/${counter.id}/share`, {
            statusCode: 503,
            body: { success: false, message: 'Sharing unavailable' },
        }).as('failedShare');
        cy.visit('/login', {
            onBeforeLoad(win) {
                cy.stub(win.navigator.clipboard, 'writeText').as('clipboard').resolves();
            },
        });
        cy.get('[data-testid="auth-email"]').type('premium@example.com');
        cy.get('[data-testid="auth-password"]').type('Password123');
        cy.get('[data-testid="auth-submit"]').click();
        cy.get(`[data-testid="counter-${counter.id}-menu"]`).click();
        cy.get(`[data-testid="counter-${counter.id}-share"]`).should('be.enabled').click();
        cy.wait('@failedShare');
        cy.get(`[data-testid="counter-${counter.id}"]`).should('contain.text', 'Sharing unavailable');
        cy.get('@clipboard').should('not.have.been.called');

        const inviteCode = crypto.randomUUID();
        cy.intercept('POST', `**/counters/${counter.id}/share`, {
            body: {
                success: true,
                data: {
                    counter: { ...counter, type: 'SHARED', inviteCode },
                },
            },
        }).as('share');
        cy.get(`[data-testid="counter-${counter.id}-menu"]`).click();
        cy.get(`[data-testid="counter-${counter.id}-share"]`).click();
        cy.wait('@share');
        cy.get('@clipboard').should(
            'have.been.calledOnceWithExactly',
            `${Cypress.config('baseUrl')}/join?code=${inviteCode}`,
        );
    });
});
