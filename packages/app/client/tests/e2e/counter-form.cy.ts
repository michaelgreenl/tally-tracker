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
        cy.get('[data-testid="counter-title"]').focus().type('{esc}');
        cy.get('[data-testid="home-counter-form"]').should('not.exist');
        cy.get('[data-testid="add-counter-button"]').should('be.focused');
        cy.reload();
        cy.get('[data-testid="counter-list"]').should('not.exist');
    });

    it('saves a metric and decimal step, applies each tap, and discards canceled changes', () => {
        cy.viewport(390, 844);
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-title"]').type('Water');
        cy.get('[data-testid="counter-metric"]').type('16oz water bottle');
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.get('[data-testid$="-increment"]').click();
        cy.get('[data-testid="home-counter-form"]').should('not.exist');
        cy.get('[data-testid="counter-increment-dialog"]').should(($dialog) => {
            const bounds = $dialog[0].getBoundingClientRect();
            expect((bounds.top + bounds.bottom) / 2, 'dialog centers in viewport').to.be.closeTo(422, 1);
        });
        cy.get('[data-testid="counter-increment-value"]').should('not.exist');
        cy.get('[data-testid="increment-editor-increase"]').click();
        cy.get('[data-testid="counter-increment-edit"]').should('have.text', '2');
        cy.get('[data-testid="increment-editor-decrease"]').click();
        cy.get('[data-testid="counter-increment-edit"]').should('have.text', '1').click();
        cy.get('[data-testid="counter-increment-value"]').clear().type('0');
        cy.get('[data-testid="counter-increment-save"]').click();
        cy.get('[data-testid="counter-increment-error"]').should('be.visible');
        cy.get('[data-testid="counter-increment-value"]').clear().type('0.1');
        cy.get('[data-testid="counter-increment-save"]').click();
        cy.get('[data-testid$="-count"]').should('have.text', '0');
        for (let tap = 0; tap < 3; tap += 1) cy.get('[data-testid$="-increase"]').click();
        cy.get('[data-testid$="-count"]').should('have.text', '0.3');
        cy.get('[data-testid$="-decrease"]').click();
        cy.get('[data-testid$="-count"]').should('have.text', '0.2');

        cy.get('[data-testid$="-increment"]').click();
        cy.get('[data-testid="counter-increment-edit"]').click();
        cy.get('[data-testid="counter-increment-value"]').clear().type('2.5');
        cy.get('[data-testid="counter-increment-cancel"]').click();
        cy.get('[data-testid$="-increment"]').should('be.focused');
        cy.reload();
        cy.get('[data-testid$="-metric"]').should('have.text', '16oz water bottle');
        cy.get('[data-testid$="-increment"]').should('have.text', '± 0.1');
        cy.get('[data-testid$="-count"]').should('have.text', '0.2');

        cy.get('[data-testid$="-menu"]').click();
        cy.get('[data-testid$="-edit"]').click();
        cy.get('[data-testid="counter-metric"]').clear();
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.reload();
        cy.get('[data-testid$="-metric"]').should('not.exist');
        cy.get('[data-testid$="-increment"]').should('have.text', '± 0.1');
    });

    it('saves custom picker colors and loads them when editing', () => {
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.get('[data-testid="counter-form-error"]').should('be.visible');
        cy.get('[data-testid="counter-title"]').type('Custom color');
        cy.get('[data-testid="counter-color-2563eb"]').click();
        cy.get('[data-testid="counter-custom-color-dialog"]').should('not.exist');
        cy.get('[data-testid="counter-custom-color"]').click();
        // The picker owns this accessible slider, so use its label instead of an internal selector.
        cy.get('[aria-label="Color hue"]').focus().type('{rightarrow}');
        cy.get('[data-testid="counter-custom-color-done"]').click();
        cy.get('[data-testid="counter-custom-color-dialog"]').should('not.exist');
        cy.get('[data-testid="counter-custom-color"]')
            .should('not.have.attr', 'aria-label', 'Custom color, selected #2563eb')
            .invoke('attr', 'aria-label')
            .then((chosenColor) => {
                cy.get('[data-testid="counter-form-submit"]').click();
                cy.get('[data-testid="home-counter-form"]').should('not.exist');
                cy.reload();
                cy.get('[data-testid^="counter-"][data-testid$="-menu"]').click();
                cy.get('[data-testid^="counter-"][data-testid$="-edit"]').click();
                cy.get('[data-testid="counter-custom-color"]').should('have.attr', 'aria-label', chosenColor);
            });

        cy.get('[data-testid="counter-color-be123c"]').click();
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.get('[data-testid="home-counter-form"]').should('not.exist');
        cy.reload();
        cy.get('[data-testid^="counter-"][data-testid$="-menu"]').click();
        cy.get('[data-testid^="counter-"][data-testid$="-edit"]').click();
        cy.get('[data-testid="counter-custom-color"]').should(
            'have.attr',
            'aria-label',
            'Custom color, selected #be123c',
        );
    });
});
