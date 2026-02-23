declare global {
    namespace Cypress {
        interface Chainable {
            login(email: string, password: string, rememberMe?: boolean): Chainable<void>;
            loginAsGuest(): Chainable<void>;
        }
    }
}

Cypress.Commands.add('login', (email: string, password: string, rememberMe = false) => {
    cy.intercept('POST', '/users/login').as('loginReq');

    cy.visit('/login');

    cy.get('.ion-page:not(.ion-page-hidden)').should('be.visible');

    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password);

    if (rememberMe) {
        cy.get('ion-toggle').click();
    }

    cy.contains('ion-button', 'Login').click();
    cy.wait('@loginReq');
    cy.url().should('include', '/home');
});

Cypress.Commands.add('loginAsGuest', () => {
    cy.visit('/login');

    cy.get('.ion-page:not(.ion-page-hidden)').should('be.visible');

    cy.get('.ion-page:not(.ion-page-hidden)').contains('Continue as guest').click();
    cy.url().should('include', '/home');
});

export {};
