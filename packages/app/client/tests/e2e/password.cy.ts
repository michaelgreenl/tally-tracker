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

            cy.visit(isRegister ? '/register' : '/forgot-password');
            cy.get(`[data-testid="${prefix}-email"]`).type(email);
            if (!isRegister) {
                cy.get('[data-testid="email-auth-request"]').click();
                cy.wait('@requestCode');
                cy.get('[data-testid="email-auth-code"]').type('123456');
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
