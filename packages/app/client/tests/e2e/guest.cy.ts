/// <reference types="cypress" />

describe('Guest counters', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
    });

    it('persists three counters and enforces the guest cap', () => {
        cy.visit('/login');
        cy.get('[data-testid="continue-as-guest"]').click();

        for (const title of ['One', 'Two', 'Three']) {
            cy.get('[data-testid="add-counter-button"]').click();
            cy.get('[data-testid="counter-title"]').type(title);
            cy.get('[data-testid="counter-form-submit"]').click();
        }

        cy.get('[data-testid="counter-list"]').children().should('have.length', 3);
        cy.reload();
        cy.get('[data-testid="counter-list"]').children().should('have.length', 3);

        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="guest-limit-modal"]').should('be.visible');
    });
});
