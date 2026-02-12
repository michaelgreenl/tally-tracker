describe('Authentication Flow', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.visit('/login');
    });

    it('allows a user to login and redirects to home (remember-me = false)', () => {
        cy.intercept('POST', '/users/login').as('loginReq');

        cy.get('input[type="email"]').type('alice@example.com');
        cy.get('input[type="password"]').type('password123');

        cy.contains('ion-button', 'Login').click();

        cy.wait('@loginReq').its('response.statusCode').should('eq', 200);

        cy.url().should('include', '/home');

        cy.getCookie('access_token').should('exist');
        cy.getCookie('refresh_token').should('not.exist');
    });

    it('allows a user to login with remember-me and receives refresh token', () => {
        cy.intercept('POST', '/users/login').as('loginReq');

        cy.get('input[type="email"]').type('alice@example.com');
        cy.get('input[type="password"]').type('password123');
        cy.get('ion-toggle').click();

        cy.contains('ion-button', 'Login').click();

        cy.wait('@loginReq').its('response.statusCode').should('eq', 200);

        cy.url().should('include', '/home');

        cy.getCookie('access_token').should('exist');
        cy.getCookie('refresh_token').should('exist');
    });
});
