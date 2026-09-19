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
            body: { success: false, message: 'Database connection refused' },
        }).as('failedShare');
        cy.visit('/login', {
            onBeforeLoad(win) {
                cy.stub(win.navigator.clipboard, 'writeText').as('clipboard').resolves();
            },
        });
        cy.get('[data-testid="auth-email"]').type('premium@example.com');
        cy.get('[data-testid="auth-password"]').type('Password123');
        cy.get('[data-testid="auth-submit"]').click();
        let cardHeight = 0;
        cy.get(`[data-testid="counter-${counter.id}"]`).then(($card) => {
            cardHeight = $card[0].getBoundingClientRect().height;
        });
        cy.get(`[data-testid="counter-${counter.id}-menu"]`).click();
        cy.get(`[data-testid="counter-${counter.id}-share"]`).should('be.enabled').click();
        cy.wait('@failedShare');
        cy.get('[data-testid="snackbar"]')
            .should('be.visible')
            .and('not.contain.text', 'Database connection refused')
            .should(($banner) => {
                const bounds = $banner[0].getBoundingClientRect();
                const viewport = $banner[0].ownerDocument.defaultView!;
                expect(bounds.left, 'message stays inside viewport').to.be.at.least(0);
                expect(bounds.right, 'message stays inside viewport').to.be.at.most(viewport.innerWidth);
                expect(viewport.innerHeight - bounds.bottom, 'message sits near the bottom edge').to.be.within(12, 24);
            });
        cy.get(`[data-testid="counter-${counter.id}"]`).should(($card) => {
            expect($card[0].getBoundingClientRect().height, 'message does not resize the card').to.equal(cardHeight);
        });
        cy.get('@clipboard').should('not.have.been.called');
        cy.get('[data-testid="snackbar-dismiss"]').click();
        cy.get('[data-testid="snackbar"]').should('not.exist');
        cy.get(`[data-testid="counter-${counter.id}-menu"]`).click();
        cy.get(`[data-testid="counter-${counter.id}-share"]`).click();
        cy.wait('@failedShare');
        cy.get('[data-testid="snackbar"]').should('be.visible');

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
        cy.get('[data-testid="snackbar"]').should('be.visible');
    });

    for (const isOwner of [true, false]) {
        it(`lets a Basic ${isOwner ? 'owner delete' : 'member leave'} an established counter after confirmation`, () => {
            const ownerId = crypto.randomUUID();
            const memberId = crypto.randomUUID();
            const counter = {
                id: crypto.randomUUID(),
                userId: ownerId,
                title: 'Shared water',
                count: 3,
                metric: null,
                increment: 1,
                type: 'SHARED',
                inviteCode: crypto.randomUUID(),
                color: '#000000',
                shares: [{ userId: memberId, status: 'ACCEPTED' }],
            };
            let removed = false;
            cy.intercept('POST', '**/users/login', {
                body: {
                    success: true,
                    data: {
                        user: {
                            id: isOwner ? ownerId : memberId,
                            email: 'basic@example.com',
                            tier: 'BASIC',
                            emailVerified: false,
                        },
                    },
                },
            });
            cy.intercept('GET', '**/counters', (req) => {
                req.reply({ success: true, data: { counters: removed ? [] : [counter] } });
            });
            cy.intercept('POST', `**/counters/${counter.id}/share`, {
                body: { success: true, data: { counter } },
            }).as('forward');
            cy.intercept(
                isOwner ? 'DELETE' : 'PUT',
                isOwner ? `**/counters/${counter.id}` : `**/counters/remove-shared/${counter.id}`,
                (req) => {
                    removed = true;
                    req.reply({ success: true });
                },
            ).as('remove');
            cy.visit('/login', {
                onBeforeLoad(win) {
                    cy.stub(win.navigator.clipboard, 'writeText').as('clipboard').resolves();
                },
            });
            cy.get('[data-testid="auth-email"]').type('basic@example.com');
            cy.get('[data-testid="auth-password"]').type('Password123');
            cy.get('[data-testid="auth-submit"]').click();
            cy.get(`[data-testid="counter-${counter.id}-menu"]`).click();
            cy.get(`[data-testid="counter-${counter.id}-share"]`).should('be.enabled').click();
            cy.wait('@forward');
            cy.get('@clipboard').should(
                'have.been.calledOnceWithExactly',
                `${Cypress.config('baseUrl')}/join?code=${counter.inviteCode}`,
            );
            cy.get('[data-testid="snackbar-dismiss"]').click();
            cy.get(`[data-testid="counter-${counter.id}-menu"]`).click();
            cy.get(`[data-testid="counter-${counter.id}-delete"]`).click();
            cy.get('[data-testid="counter-remove-confirm"]').should('be.visible');
            let changedDuringDismissal = false;
            let observer: MutationObserver;
            cy.get('[data-testid="counter-remove-confirm"]').then(($dialog) => {
                const dialog = $dialog[0];
                const original = dialog.textContent;
                observer = new dialog.ownerDocument.defaultView!.MutationObserver(() => {
                    if (dialog.textContent !== original) changedDuringDismissal = true;
                });
                observer.observe(dialog, { subtree: true, characterData: true, childList: true });
            });
            cy.get('[data-testid="counter-remove-cancel"]').click();
            cy.get('[data-testid="counter-remove-confirm"]')
                .should('not.exist')
                .then(() => {
                    observer.disconnect();
                    expect(changedDuringDismissal, 'dialog content stays stable during its exit animation').to.equal(
                        false,
                    );
                });
            cy.get('@remove.all').should('have.length', 0);
            cy.get(`[data-testid="counter-${counter.id}-menu"]`).click();
            cy.get(`[data-testid="counter-${counter.id}-delete"]`).click();
            cy.get('[data-testid="counter-remove-submit"]').click();
            cy.wait('@remove');
            cy.get(`[data-testid="counter-${counter.id}"]`).should('not.exist');
            cy.get('[data-testid="counter-remove-confirm"]').should('not.exist');
        });
    }
});
