/// <reference types="cypress" />

describe('Login controls', () => {
    for (const route of ['/login', '/register', '/forgot-password']) {
        it(`rejects malformed email locally on ${route}`, () => {
            const recovery = route === '/forgot-password';
            const prefix = recovery ? 'email-auth' : 'auth';
            const endpoint = recovery
                ? '**/users/reset-password/request'
                : route === '/login'
                  ? '**/users/login'
                  : '**/users';
            cy.intercept('POST', endpoint, { statusCode: 401, body: { success: false } }).as('submit');
            cy.visit(route);
            if (!recovery) cy.get('[data-testid="auth-password"]').type('Valid-password123');
            if (route === '/register') cy.get('[data-testid="auth-confirm-password"]').type('Valid-password123');

            for (const email of ['', '@@@@', 'person@', 'person@example..com']) {
                cy.get(`[data-testid="${prefix}-email"]`).clear();
                if (email) cy.get(`[data-testid="${prefix}-email"]`).type(email);
                cy.get(`[data-testid="${prefix}-${recovery ? 'request' : 'submit'}"]`).click();
                cy.get(`[data-testid="${prefix}-error"]`).should('be.visible');
                cy.get('@submit.all').should('have.length', 0);
            }

            cy.get(`[data-testid="${prefix}-email"]`).clear().type('person+test@example.com');
            cy.get(`[data-testid="${prefix}-${recovery ? 'request' : 'submit'}"]`).click();
            cy.wait('@submit').its('request.body.email').should('eq', 'person+test@example.com');
        });
    }

    it('requires a password before either login submit action sends a request', () => {
        cy.intercept('POST', '**/users/login', { statusCode: 401, body: { success: false } }).as('login');
        cy.visit('/login');
        cy.get('[data-testid="auth-email"]').type('person@example.com');
        cy.get('[data-testid="auth-submit"]').click();
        cy.get('[data-testid="auth-error"]').should('be.visible');
        cy.get('@login.all').should('have.length', 0);
        cy.get('[data-testid="auth-password"]').type('{enter}');
        cy.get('@login.all').should('have.length', 0);
        cy.get('[data-testid="auth-submit-loading"]').should('not.exist');
        // Existing passwords need not satisfy new-password complexity rules.
        cy.get('[data-testid="auth-password"]').type('old-password{enter}');
        cy.wait('@login').its('request.body.password').should('eq', 'old-password');
    });

    it('keeps enlarged error text inside its box without an orphaned last word', () => {
        cy.intercept('POST', '**/users/login', {
            statusCode: 401,
            body: { success: false, message: 'Something went wrong. Please try again later.' },
        }).as('login');
        cy.visit('/login');
        cy.get('[data-testid="auth-email"]').type('person@example.com');
        cy.get('[data-testid="auth-password"]').type('incorrect-password');
        cy.get('[data-testid="auth-submit"]').click();
        cy.wait('@login');

        for (const [width, height] of [
            [375, 812],
            [812, 375],
        ]) {
            cy.viewport(width, height);
            for (const fontSize of [16, 18, 20, 24, 28, 32]) {
                cy.get('[data-testid="auth-error-message"]').invoke('css', {
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.4',
                });
                cy.get('[data-testid="auth-error-message"]')
                    .scrollIntoView()
                    .should(($message) => {
                        const element = $message[0];
                        const bounds = element.getBoundingClientRect();
                        const lines = new Map<number, number>();
                        for (const word of element.textContent!.matchAll(/\S+/g)) {
                            const range = element.ownerDocument.createRange();
                            range.setStart(element.firstChild!, word.index);
                            range.setEnd(element.firstChild!, word.index + word[0].length);
                            const rect = range.getBoundingClientRect();
                            expect(rect.left, 'word stays inside left edge').to.be.at.least(bounds.left - 1);
                            expect(rect.right, 'word stays inside right edge').to.be.at.most(bounds.right + 1);
                            expect(rect.bottom, 'last line is not clipped').to.be.at.most(bounds.bottom + 1);
                            lines.set(rect.top, (lines.get(rect.top) ?? 0) + 1);
                        }
                        if (fontSize >= 24) expect(lines.size, 'exercise multiline text').to.be.greaterThan(1);
                        if (lines.size > 1)
                            expect([...lines.values()].at(-1), 'last line has more than one word').to.be.greaterThan(1);
                    });
            }
        }
    });

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
