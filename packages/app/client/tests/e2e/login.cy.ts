/// <reference types="cypress" />

describe('Login controls', () => {
    it('shows focus underlines on account links and follows their routes', () => {
        cy.visit('/login');
        cy.get('[data-testid="auth-switch-mode"]').focus();
        cy.focused().children().should('have.css', 'text-decoration-line', 'underline');

        for (const [testID, pathname] of [
            ['auth-switch-mode', '/register'],
            ['auth-switch-mode', '/login'],
            ['auth-forgot-password', '/forgot-password'],
        ]) {
            cy.get(`[data-testid="${testID}"]`).filter(':visible').should('have.length', 1).click();
            cy.location('pathname').should('eq', pathname);
        }
    });

    it('toggles Remember me only from the checkbox, including keyboard input', () => {
        cy.visit('/login');
        cy.get('[data-testid="auth-remember-me-label"]').click();
        cy.get('[data-testid="auth-remember-me"]').should('not.be.checked').click().should('be.checked');
        cy.get('[data-testid="auth-remember-me-label"]').click();
        cy.get('[data-testid="auth-remember-me"]').should('be.checked').focus().type(' ').should('not.be.checked');
    });

    it('uses matching focus borders without browser outlines', () => {
        cy.visit('/login');
        cy.get('[data-testid="auth-password-field"]').then(($field) => {
            const unfocusedBorder = $field.css('border-color');

            cy.get('[data-testid="auth-email"]').focus().should('have.css', 'outline-style', 'none');
            cy.get('[data-testid="auth-email"]').should('not.have.css', 'border-color', unfocusedBorder);
            cy.get('[data-testid="auth-email"]').then(($email) => {
                const focusedBorder = $email.css('border-color');

                cy.get('[data-testid="auth-password"]').focus().should('have.css', 'outline-style', 'none');
                cy.get('[data-testid="auth-password-field"]').should('have.css', 'border-color', focusedBorder);
                cy.get('[data-testid="auth-email"]').should('have.css', 'border-color', unfocusedBorder);

                cy.get('[data-testid="auth-password"]').blur();
                cy.get('[data-testid="auth-password-field"]').should('have.css', 'border-color', unfocusedBorder);
            });
        });
    });

    it('submits the current checkbox value on each login attempt', () => {
        cy.clearCookies();
        cy.clearLocalStorage();
        cy.intercept('POST', '**/users/login', {
            statusCode: 401,
            body: { success: false, message: 'Incorrect password.' },
        }).as('login');
        cy.visit('/login');
        cy.get('[data-testid="auth-email"]').type('checkbox@example.invalid');
        cy.get('[data-testid="auth-password"]').type('incorrect-password');

        cy.get('[data-testid="auth-remember-me"]').should('not.be.checked').click().should('be.checked');
        cy.get('[data-testid="auth-submit"]').click();
        cy.wait('@login').its('request.body.rememberMe').should('eq', true);

        cy.get('[data-testid="auth-remember-me"]').click().should('not.be.checked');
        cy.get('[data-testid="auth-submit"]').click();
        cy.wait('@login').its('request.body.rememberMe').should('eq', false);
    });
});
