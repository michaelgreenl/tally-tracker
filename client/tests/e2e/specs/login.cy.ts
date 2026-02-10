describe('Authentication Flow', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.visit('/login');
    });

    it('allows a user to login and redirects to home', () => {
        cy.intercept('POST', '/users/login').as('loginReq');

        cy.get('input[type="email"]').type('alice@example.com');
        cy.get('input[type="password"]').type('password123');

        cy.contains('ion-button', 'Login').click();

        cy.wait('@loginReq').its('response.statusCode').should('eq', 200);

        cy.url().should('include', '/home');

        cy.getCookie('token').should('exist');
    });
});
