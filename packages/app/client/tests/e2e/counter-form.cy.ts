/// <reference types="cypress" />

describe('Counter sheet', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
        cy.visit('/home');
    });

    it('keeps actions reachable and discards canceled drafts', () => {
        for (const [width, height] of [
            [1000, 900],
            [440, 956],
            [320, 400],
        ]) {
            cy.viewport(width, height);
            cy.get('[data-testid="add-counter-button"]').click();
            cy.get('[data-testid="home-counter-form"]').should(($sheet) => {
                const bounds = $sheet[0].getBoundingClientRect();
                expect(bounds.bottom, 'sheet touches viewport bottom').to.be.closeTo(height, 1);
                expect(bounds.top, 'sheet stays inside viewport').to.be.at.least(0);
                expect(bounds.width, 'sheet fits viewport width').to.be.at.most(width);
            });
            cy.get('[data-testid="counter-title"]').should('have.value', '').type('Discard this draft');
            cy.get('[data-testid="counter-form-submit"]').should(($button) => {
                const bounds = $button[0].getBoundingClientRect();
                expect(bounds.top, 'save action remains on screen').to.be.at.least(0);
                expect(bounds.bottom, 'save action clears viewport bottom').to.be.at.most(height);
            });
            cy.get('[data-testid="counter-form-cancel"]').click();
            cy.get('[data-testid="home-counter-form"]').should('not.exist');
        }

        cy.viewport(440, 956);
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-title"]').should('have.value', '');
        cy.focused().closest('[data-testid="home-counter-form"]').should('exist');
        cy.focused().type('{esc}');
        cy.get('[data-testid="home-counter-form"]').should('not.exist');
        cy.get('[data-testid="add-counter-button"]').should('be.focused');
        cy.reload();
        cy.get('[data-testid="counter-list"]').should('not.exist');
    });

    it('saves custom picker colors and loads them when editing', () => {
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-sharing"]').should('be.disabled').and('not.be.checked');
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.get('[data-testid="counter-form-error"]').should('be.visible');
        cy.get('[data-testid="counter-title"]').type('Custom color');
        cy.get('[data-testid="counter-color-2563eb"]').click();
        // The picker owns this accessible slider, so use its label instead of an internal selector.
        cy.get('[aria-label="Color hue"]').focus().type('{rightarrow}');
        cy.get('[data-testid="counter-color-preview"]')
            .should('not.have.attr', 'aria-label', 'Selected color #2563eb')
            .invoke('attr', 'aria-label')
            .then((chosenColor) => {
                cy.get('[data-testid="counter-form-submit"]').click();
                cy.get('[data-testid="home-counter-form"]').should('not.exist');
                cy.reload();
                cy.get('[data-testid^="counter-"][data-testid$="-edit"]').click();
                cy.get('[data-testid="counter-color-preview"]').should('have.attr', 'aria-label', chosenColor);
            });

        cy.get('[data-testid="counter-color-be123c"]').click();
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.get('[data-testid="home-counter-form"]').should('not.exist');
        cy.reload();
        cy.get('[data-testid^="counter-"][data-testid$="-edit"]').click();
        cy.get('[data-testid="counter-color-preview"]').should('have.attr', 'aria-label', 'Selected color #be123c');
    });
});
