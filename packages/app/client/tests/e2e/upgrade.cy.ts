/// <reference types="cypress" />

describe('Upgrade', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
    });

    it('lets guests compare plans without buying and choose a free account', () => {
        cy.viewport(390, 844);
        cy.visit('/upgrade');
        cy.get('[data-testid="upgrade-plan-yearly"]').should('have.attr', 'aria-pressed', 'true');
        cy.get('[data-testid="upgrade-plan-monthly"]').click().should('have.attr', 'aria-pressed', 'true');
        cy.get('[data-testid="upgrade-plan-yearly"]').should('have.attr', 'aria-pressed', 'false');
        cy.get('[data-testid="upgrade-plan-lifetime"]').click();
        cy.get('[data-testid="upgrade-plan-lifetime"]').should('have.attr', 'aria-pressed', 'true');
        cy.get('[data-testid="upgrade-plan-monthly"]').should('have.attr', 'aria-pressed', 'false');
        cy.get('[data-testid="upgrade-purchase"]').should('be.disabled');
        cy.get('[data-testid="upgrade-restore"]').should('be.disabled');
        cy.get('[data-testid="upgrade-register"]').click();
        cy.location('pathname').should('eq', '/register');
    });

    for (const tier of ['BASIC', 'PREMIUM']) {
        it(`opens the ${tier} account's upgrade state from Settings and returns there`, () => {
            cy.viewport(390, 844);
            cy.intercept('POST', '**/users/login', {
                body: {
                    success: true,
                    data: {
                        user: { id: 'upgrade-user', email: 'upgrade@example.com', tier, emailVerified: true },
                    },
                },
            });
            cy.intercept('GET', '**/counters', { body: { success: true, data: { counters: [] } } });
            cy.visit('/login');
            cy.get('[data-testid="auth-email"]').type('upgrade@example.com');
            cy.get('[data-testid="auth-password"]').type('Password123');
            cy.get('[data-testid="auth-submit"]').click();
            cy.get('[data-testid="home-settings-link"]').click();
            cy.get('[data-testid="settings-logout"]').then(($logout) => {
                const logout = $logout[0].getBoundingClientRect();
                cy.get('[data-testid="settings-subscription"]').should(($row) => {
                    const row = $row[0].getBoundingClientRect();
                    expect(row.top, 'subscription follows the account row').to.be.closeTo(logout.bottom, 1);
                    expect(row.width, 'subscription spans the account section').to.be.closeTo(logout.width, 1);
                    expect(row.height, 'subscription has a full tap target').to.be.at.least(48);
                });
            });
            cy.get('[data-testid="settings-subscription"]').click();
            cy.location('pathname').should('eq', '/upgrade');
            cy.get('[data-testid="upgrade-free-account"]').should('not.exist');

            if (tier === 'PREMIUM') {
                cy.get('[data-testid="upgrade-active"]').should('be.visible');
                cy.get('[data-testid="upgrade-plans"]').should('not.exist');
                cy.get('[data-testid="upgrade-purchase"]').should('not.exist');
            } else {
                cy.get('[data-testid="upgrade-plans"]').should('be.visible');
                cy.get('[data-testid="upgrade-active"]').should('not.exist');
                cy.get('[data-testid="upgrade-purchase"]').should('be.disabled');
            }

            cy.get('[data-testid="upgrade-back"]').click();
            cy.location('pathname').should('eq', '/settings');
        });
    }
});
