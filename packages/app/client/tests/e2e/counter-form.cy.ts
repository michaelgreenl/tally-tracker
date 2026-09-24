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
        cy.get('[data-testid="increment-editor-edit-value"]').should('have.text', '2');
        cy.get('[data-testid="increment-editor-decrease"]').click();
        cy.get('[data-testid="increment-editor-edit-value"]').should('have.text', '1').click();
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
        cy.get('[data-testid="increment-editor-edit-value"]').click();
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

    it('dismisses increment changes only when clicking outside the dialog', () => {
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-title"]').type('Water');
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.get('[data-testid="home-counter-form"]').should('not.exist');

        for (const [width, height] of [
            [1000, 900],
            [390, 844],
        ]) {
            cy.viewport(width, height);
            cy.get('[data-testid$="-increment"]').click();
            cy.get('[data-testid="counter-increment-cancel"]').should('be.focused');
            cy.get('[data-testid="counter-increment-dialog"]').click(8, 8);
            cy.get('[data-testid="increment-editor-edit-value"]').should('have.text', '1').click();
            cy.get('[data-testid="counter-increment-value"]').clear().type('2.5');
            cy.get('[data-testid="counter-increment-dialog-backdrop"]')
                .should(($backdrop) => {
                    const backdrop = $backdrop[0];
                    const { left, top } = backdrop.getBoundingClientRect();
                    expect(backdrop.ownerDocument.elementFromPoint(left + 10, top + 10)).to.equal(backdrop);
                })
                // Cypress checks the covered center; verify the actual outside hit target above instead.
                .click(10, 10, { force: true });
            cy.get('[data-testid="counter-increment-dialog"]').should('not.exist');
            cy.get('[data-testid$="-increment"]').should('be.focused');
        }

        cy.reload();
        cy.get('[data-testid$="-increment"]').should('have.text', '± 1');
    });

    it('edits the count with its decimal step and saves negative values and zero', () => {
        cy.viewport(390, 844);
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-title"]').type('Water');
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.get('[data-testid$="-increment"]').click();
        cy.get('[data-testid="increment-editor-edit-value"]').click();
        cy.get('[data-testid="counter-increment-value"]').clear().type('0.5');
        cy.get('[data-testid="counter-increment-save"]').click();

        cy.get('[data-testid$="-count"]').click();
        cy.get('[data-testid="counter-count-value"]').should('have.value', '0').clear().type('-12,5');
        cy.get('[data-testid="count-editor-increase"]').click();
        cy.get('[data-testid="count-editor-count"]').should('have.text', '-12').click();
        cy.get('[data-testid="counter-count-value"]').clear().type('-12.75');
        cy.get('[data-testid="counter-count-save"]').click();
        cy.get('[data-testid="counter-count-dialog"]').should('not.exist');
        cy.get('[data-testid$="-count"]').should('have.text', '-12.75');
        cy.get('[data-testid$="-increase"]').click();
        cy.reload();
        cy.get('[data-testid$="-count"]').should('have.text', '-12.25').click();
        cy.get('[data-testid="counter-count-value"]').clear().type('0');
        cy.get('[data-testid="counter-count-save"]').click();
        cy.reload();
        cy.get('[data-testid$="-count"]').should('have.text', '0');
    });

    it('keeps number form actions smaller than the steppers and above the title midpoint', () => {
        cy.viewport(320, 568);
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-title"]').type('Water');
        cy.get('[data-testid="counter-form-submit"]').click();

        for (const [width, height, titleSize] of [
            [320, 568, 24],
            [440, 956, 32],
        ]) {
            cy.viewport(width, height);
            for (const field of ['increment', 'count']) {
                cy.get(`[data-testid$="-${field}"]`).click();
                cy.get(`[data-testid="counter-${field}-dialog-title"]`).invoke('css', 'font-size', `${titleSize}px`);
                cy.get(`[data-testid="${field}-editor-increase"]`).then(($step) => {
                    const step = $step[0].getBoundingClientRect();
                    cy.get(`[data-testid="counter-${field}-dialog-title"]`).then(($title) => {
                        const title = $title[0].getBoundingClientRect();
                        for (const action of ['cancel', 'save']) {
                            cy.get(`[data-testid="counter-${field}-${action}"]`).should(($button) => {
                                const bounds = $button[0].getBoundingClientRect();
                                expect(bounds.width, `${action} width is slightly smaller`).to.equal(step.width - 4);
                                expect(bounds.height, `${action} height is slightly smaller`).to.equal(step.height - 4);
                                expect(bounds.bottom, `${action} bottom aligns with title midpoint`).to.be.closeTo(
                                    title.top + title.height / 2,
                                    1,
                                );
                                expect(bounds.left).to.be.at.least(20);
                                expect(bounds.right).to.be.at.most(width - 20);
                            });
                        }
                    });
                });
                cy.get(`[data-testid="counter-${field}-cancel"]`).click();
            }
        }
    });

    it('rejects invalid counts and discards drafts on cancel or outside press', () => {
        cy.viewport(320, 568);
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-title"]').type('Water');
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.get('[data-testid="home-counter-form"]').should('not.exist');
        cy.get('[data-testid$="-count"]').click();
        cy.get('[data-testid="counter-count-value"]').should('be.focused');
        for (const draft of ['', '-', '1.0000001', '1000000000', 'NaN']) {
            cy.get('[data-testid="counter-count-value"]').clear().should('have.value', '');
            if (draft) cy.get('[data-testid="counter-count-value"]').type(draft);
            cy.get('[data-testid="counter-count-save"]').click();
            cy.get('[data-testid="counter-count-error"]').should('be.visible');
            cy.get('[data-testid="counter-count-value"]').should('have.value', draft);
        }
        cy.get('[data-testid="counter-count-value"]').clear().type('42');
        cy.get('[data-testid="counter-count-cancel"]').click();
        cy.get('[data-testid$="-count"]').should('have.text', '0').click();
        cy.get('[data-testid="counter-count-value"]').should('have.value', '0').clear().type('99');
        cy.get('[data-testid="counter-count-dialog-backdrop"]').click(10, 10, { force: true });
        cy.get('[data-testid="counter-count-dialog"]').should('not.exist');
        cy.get('[data-testid$="-edit-value"]').should('be.focused');
        cy.reload();
        cy.get('[data-testid$="-count"]').should('have.text', '0');
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
