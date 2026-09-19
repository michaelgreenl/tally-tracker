/// <reference types="cypress" />

describe('Login controls', () => {
    it('goes back through auth history and provides a destination for direct links', () => {
        cy.visit('/login');
        cy.get('[data-testid="auth-switch-mode"]').click();
        cy.get('[data-testid="auth-register-back"]').click();
        cy.location('pathname').should('eq', '/login');
        cy.get('[data-testid="auth-login-back"]').click();
        cy.location('pathname').should('eq', '/home');

        cy.visit('/register');
        cy.get('[data-testid="auth-switch-mode"]').click();
        cy.get('[data-testid="auth-login-back"]').click();
        cy.location('pathname').should('eq', '/register');
        cy.get('[data-testid="auth-register-back"]').click();
        cy.location('pathname').should('eq', '/login');
    });

    for (const route of ['/login', '/register']) {
        it(`centers ${route} in the viewport and keeps the form reachable on short screens`, () => {
            cy.visit(route);

            for (const [width, height] of [
                [1000, 900],
                [440, 956],
            ]) {
                cy.viewport(width, height);
                cy.get('[data-testid="auth-card"]').should(($card) => {
                    const bounds = $card[0].getBoundingClientRect();
                    expect(bounds.top + bounds.height / 2, 'card center').to.be.closeTo(height / 2, 1);
                });
            }

            cy.viewport(375, 400);
            cy.get('[data-testid="auth-page-header"]').then(($header) => {
                cy.get('[data-testid="auth-card"]').should(($card) => {
                    expect($card[0].getBoundingClientRect().top, 'card clears header').to.be.at.least(
                        $header[0].getBoundingClientRect().bottom,
                    );
                });
            });
            cy.get('[data-testid="auth-scroll"]').scrollTo('bottom');
            cy.get('[data-testid="auth-switch-mode"]').should(($link) => {
                const bounds = $link[0].getBoundingClientRect();
                expect(bounds.top, 'footer reaches viewport').to.be.at.least(0);
                expect(bounds.bottom, 'footer stays inside viewport').to.be.at.most(400);
            });
        });
    }

    it('shows focus underlines on account links and follows their routes', () => {
        cy.visit('/login');
        cy.get('[data-testid="auth-switch-mode"]').focus();
        cy.focused().children().should('have.css', 'text-decoration-line', 'underline');

        for (const [testID, pathname] of [
            ['auth-switch-mode', '/register'],
            ['auth-switch-mode', '/login'],
            ['auth-forgot-password', '/forgot-password'],
        ]) {
            cy.get('[data-testid="auth-scroll"]').filter(':visible').scrollTo('bottom');
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

            cy.get('[data-testid="auth-email"]').click().should('have.focus').and('have.css', 'outline-style', 'none');
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

    it('keeps the active auth field focused when the browser scrolls', () => {
        cy.viewport(375, 300);
        for (const [route, field, scroll] of [
            ['/login', 'auth-email', 'auth-scroll'],
            ['/register', 'auth-email', 'auth-scroll'],
            ['/forgot-password', 'email-auth-email', 'email-auth-scroll'],
        ]) {
            cy.visit(route);
            cy.get(`[data-testid="${field}"]`).focus();
            cy.get(`[data-testid="${scroll}"]`).scrollTo('bottom', { duration: 200 });
            cy.get(`[data-testid="${field}"]`).should('have.focus');
        }
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
