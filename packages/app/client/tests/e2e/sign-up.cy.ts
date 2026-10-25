/// <reference types="cypress" />

describe('Sign-up username', () => {
    const user = {
        id: 'new-user',
        email: 'signup@example.invalid',
        username: null,
        tier: 'BASIC',
        emailVerified: true,
    };

    // New accounts choose a username after sign-up.
    function visitUsernameStep() {
        cy.intercept('GET', '**/users/check-auth', { body: { success: true, data: { user } } });
        cy.intercept('GET', '**/counters', { body: { success: true, data: { counters: [] } } });
        cy.visit('/register', {
            onBeforeLoad(win) {
                win.localStorage.setItem('auth_user_profile', JSON.stringify(user));
            },
        });
    }

    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
    });

    it('shows unavailable names before submit and handles a name claimed after the check', () => {
        cy.intercept('POST', '**/users/username/availability', (req) =>
            req.reply({ success: true, data: { available: req.body.username !== 'taken_name' } }),
        ).as('availability');
        cy.intercept('POST', '**/users/username', {
            statusCode: 409,
            body: { success: false, message: 'That username is taken.' },
        }).as('setUsername');
        visitUsernameStep();
        cy.get('[data-testid="auth-username"]').type('ab');
        cy.get('[data-testid="auth-submit"]').click();
        cy.get('[data-testid="auth-username"]').should('have.focus').and('have.attr', 'aria-invalid', 'true');
        cy.get('@availability.all').should('have.length', 0);
        cy.get('[data-testid="auth-username"]').clear().type('taken_name');
        cy.wait('@availability');
        cy.get('[data-testid="auth-username"]').should('have.attr', 'aria-invalid', 'true');
        cy.get('[data-testid="auth-submit"]').should('be.disabled');
        cy.get('@setUsername.all').should('have.length', 0);

        cy.get('[data-testid="auth-username"]').clear().type('new_name');
        cy.wait('@availability');
        cy.get('[data-testid="auth-submit"]').click();
        cy.wait('@setUsername');
        cy.get('[data-testid="auth-username"]')
            .should('have.value', 'new_name')
            .and('have.attr', 'aria-invalid', 'true');
        cy.get('[data-testid="auth-submit"]').should('be.disabled');
        cy.get('[data-testid="auth-username"]').type('_2');
        cy.wait('@availability');
        cy.get('[data-testid="auth-submit"]').should('not.be.disabled');
    });

    it('ignores a late availability response for a name that was replaced', () => {
        let oldRequestStarted = false;
        cy.intercept('POST', '**/users/username/availability', (req) => {
            const old = req.body.username === 'old_name';
            if (old) oldRequestStarted = true;
            req.alias = old ? 'oldName' : 'currentName';
            req.reply({ delay: old ? 1500 : 0, body: { success: true, data: { available: !old } } });
        });
        visitUsernameStep();
        cy.get('[data-testid="auth-username"]').type('old_name');
        cy.get('[data-testid="auth-username-help"]').should('contain.text', 'Checking');
        cy.wrap(null).should(() => expect(oldRequestStarted, 'first request is in flight').to.equal(true));
        cy.get('[data-testid="auth-username"]').clear().type('current_name');
        cy.wait('@currentName');
        cy.wait('@oldName');
        cy.get('[data-testid="auth-username"]').should('have.attr', 'aria-invalid', 'false');
        cy.get('[data-testid="auth-submit"]').should('not.be.disabled');
    });

    it('starts below the header and can scroll the whole form into view on short screens', () => {
        for (const [width, height] of [
            [375, 667],
            [440, 956],
            [812, 375],
        ]) {
            cy.viewport(width, height);
            cy.visit('/register');
            cy.get('[data-testid="auth-page-header"]').then(($header) => {
                const bottom = $header[0].getBoundingClientRect().bottom;
                cy.get('[data-testid="auth-card"]').should(($card) => {
                    const top = $card[0].getBoundingClientRect().top;
                    expect(top - bottom, 'small top gap, not vertical centering').to.be.within(10, 16);
                });
            });
            cy.get('[data-testid="auth-legal-links"]')
                .scrollIntoView()
                .should(($footer) => {
                    const bounds = $footer[0].getBoundingClientRect();
                    expect(bounds.bottom).to.be.at.most(height);
                    expect(bounds.top).to.be.at.least(0);
                });
        }
    });

    it('keeps an unverified account on email verification until it logs out', () => {
        const unverified = { ...user, username: 'unverified_user', emailVerified: false };
        cy.intercept('GET', '**/users/check-auth', { body: { success: true, data: { user: unverified } } });
        cy.intercept('GET', '**/counters', { body: { success: true, data: { counters: [] } } });
        cy.intercept('POST', '**/users/logout', { body: { success: true } });
        cy.visit('/home', {
            onBeforeLoad(win) {
                win.localStorage.setItem('auth_user_profile', JSON.stringify(unverified));
            },
        });
        cy.location('pathname').should('eq', '/verify-email');
        cy.get('[data-testid="email-auth-logout"]').click();
        cy.location('pathname').should('eq', '/login');
    });
});
