/// <reference types="cypress" />

describe('New password requirements', () => {
    for (const mode of ['register', 'reset']) {
        it(`blocks invalid passwords before submitting ${mode}`, () => {
            const isRegister = mode === 'register';
            const prefix = isRegister ? 'auth' : 'email-auth';
            const email = 'password-rules@example.invalid';

            cy.intercept('POST', isRegister ? '**/users' : '**/users/reset-password', {
                statusCode: isRegister ? 201 : 200,
                body: { success: true },
            }).as('submitPassword');
            cy.intercept('POST', '**/users/reset-password/request', {
                statusCode: 200,
                body: { success: true },
            }).as('requestCode');
            cy.intercept('POST', '**/users/reset-password/verify', {
                statusCode: 200,
                body: { success: true },
            }).as('verifyCode');

            cy.visit(isRegister ? '/register' : '/forgot-password');
            cy.get(`[data-testid="${prefix}-email"]`).type(email);
            if (!isRegister) {
                cy.get('[data-testid="email-auth-request"]').click();
                cy.wait('@requestCode');
                cy.get('[data-testid="email-auth-code"]').type('123456');
                cy.get('[data-testid="email-auth-submit"]').click();
                cy.wait('@verifyCode');
            }

            for (const password of ['Abc12', 'abcdef1', 'Abcdef']) {
                cy.get(`[data-testid="${prefix}-password"]`).clear().type(password);
                cy.get(`[data-testid="${prefix}-confirm-password"]`).clear().type(password);
                cy.get(`[data-testid="${prefix}-submit"]`).click();
                cy.get(`[data-testid="${prefix}-error"]`).should('be.visible');
                cy.get('@submitPassword.all').should('have.length', 0);
            }

            cy.get(`[data-testid="${prefix}-password"]`).clear().type('Abcde1');
            cy.get(`[data-testid="${prefix}-confirm-password"]`).clear().type('Abcde1');
            cy.get(`[data-testid="${prefix}-submit"]`).click();
            cy.wait('@submitPassword')
                .its('request.body')
                .should('deep.equal', {
                    email,
                    password: 'Abcde1',
                    ...(!isRegister && { code: '123456' }),
                });
            if (isRegister) cy.location('pathname').should('eq', '/verify-email');
            else cy.get('[data-testid="email-auth-submit"]').should('not.exist');
        });
    }
});

describe('Password recovery', () => {
    it('keeps the email through separate, explicitly submitted steps and back to login', () => {
        const email = 'reset@example.invalid';
        cy.intercept('POST', '**/users/reset-password/request', { body: { success: true } }).as('requestCode');
        cy.intercept('POST', '**/users/reset-password/verify', (request) => {
            request.reply(
                request.body.code === '123456'
                    ? { body: { success: true } }
                    : { statusCode: 422, body: { success: false, message: 'The code is invalid or expired.' } },
            );
        }).as('verifyCode');
        cy.intercept('POST', '**/users/reset-password', { body: { success: true } }).as('resetPassword');

        cy.visit('/login?inviteCode=shared-invite');
        cy.get('[data-testid="auth-email"]').type('first@example.invalid');
        cy.get('[data-testid="auth-password"]').type('Old-password1');
        cy.get('[data-testid="auth-forgot-password"]').click();
        cy.get('[data-testid="email-auth-email"]').should('have.value', 'first@example.invalid').clear().type(email);
        cy.get('[data-testid="email-auth-code"]').should('not.exist');
        cy.get('[data-testid="email-auth-password"]').should('not.exist');
        cy.get('[data-testid="email-auth-request"]').click();
        cy.wait('@requestCode').its('request.body').should('deep.equal', { email });

        cy.get('[data-testid="email-auth-email"]').should('not.exist');
        cy.get('[data-testid="email-auth-password"]').should('not.exist');
        cy.get('[data-testid="email-auth-code"]').type('000000');
        cy.get('@verifyCode.all').should('have.length', 0);
        cy.get('[data-testid="email-auth-submit"]').click();
        cy.wait('@verifyCode').its('response.statusCode').should('eq', 422);
        cy.get('[data-testid="email-auth-error"]').should('be.visible');
        cy.get('[data-testid="email-auth-password"]').should('not.exist');

        cy.get('[data-testid="email-auth-code"]').clear().type('123456');
        cy.get('[data-testid="email-auth-submit"]').click();
        cy.wait('@verifyCode').its('request.body').should('deep.equal', { email, code: '123456' });
        cy.get('[data-testid="email-auth-code"]').should('not.exist');
        cy.get('[data-testid="email-auth-email"]').should('not.exist');
        cy.get('[data-testid="email-auth-password"]').type('New-password1');
        cy.get('[data-testid="email-auth-confirm-password"]').type('New-password1');
        cy.get('[data-testid="email-auth-submit"]').click();
        cy.wait('@resetPassword')
            .its('request.body')
            .should('deep.equal', { email, code: '123456', password: 'New-password1' });

        cy.get('[data-testid="email-auth-login"]').click();
        cy.location('pathname').should('eq', '/login');
        cy.location('search').should('include', 'inviteCode=shared-invite');
        cy.get('[data-testid="auth-email"]').filter(':visible').should('have.value', email);
        cy.get('[data-testid="auth-password"]').filter(':visible').should('have.value', '');
    });

    it('keeps the latest email when changing auth forms or restarting code entry', () => {
        cy.intercept('POST', '**/users/reset-password/request', { body: { success: true } }).as('requestCode');
        cy.intercept('POST', '**/users/reset-password/verify', { body: { success: true } }).as('verifyCode');
        cy.visit('/login');
        cy.get('[data-testid="auth-email"]').type('first@example.invalid');
        cy.get('[data-testid="auth-switch-mode"]').click();
        cy.get('[data-testid="auth-email"]')
            .filter(':visible')
            .should('have.value', 'first@example.invalid')
            .clear()
            .type('second@example.invalid');
        cy.get('[data-testid="auth-switch-mode"]').filter(':visible').click();
        cy.get('[data-testid="auth-email"]').filter(':visible').should('have.value', 'second@example.invalid');
        cy.get('[data-testid="auth-forgot-password"]').filter(':visible').click();
        cy.get('[data-testid="email-auth-request"]').click();
        cy.wait('@requestCode');
        cy.get('[data-testid="email-auth-code"]').type('123456');
        cy.get('[data-testid="email-auth-submit"]').click();
        cy.wait('@verifyCode');
        cy.get('[data-testid="email-auth-password"]').type('Discard-password1');
        cy.get('[data-testid="email-auth-change-code"]').click();
        cy.get('[data-testid="email-auth-password"]').should('not.exist');
        cy.get('[data-testid="email-auth-resend"]').click();
        cy.wait('@requestCode').its('request.body').should('deep.equal', { email: 'second@example.invalid' });
        cy.get('[data-testid="email-auth-code"]').should('have.value', '');
        cy.get('[data-testid="email-auth-change-email"]').click();
        cy.get('[data-testid="email-auth-code"]').should('not.exist');
        cy.get('[data-testid="email-auth-email"]').should('have.value', 'second@example.invalid');
        cy.get('[data-testid="email-auth-login"]').click();
        cy.get('[data-testid="auth-email"]').filter(':visible').should('have.value', 'second@example.invalid');
    });
});
