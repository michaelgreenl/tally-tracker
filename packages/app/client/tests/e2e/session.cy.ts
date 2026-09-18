/// <reference types="cypress" />

it('finishes an old logout before a second browser context installs another account’s cookies', () => {
    cy.clearCookies();
    cy.clearLocalStorage();
    const credentials = (name: string) => ({
        email: `${name}-${crypto.randomUUID()}@example.com`,
        password: 'New-password123',
    });
    const a = credentials('logout-a');
    const b = credentials('login-b');
    cy.request('POST', '/users', a);
    cy.request('POST', '/users', b);
    cy.request('POST', '/users/login', a).then(({ body }) => {
        cy.visit('/settings', {
            onBeforeLoad: (win) => win.localStorage.setItem('auth_user_profile', JSON.stringify(body.data.user)),
        });
    });

    let finish!: () => void;
    const delayed = new Cypress.Promise<void>((resolve) => {
        finish = resolve;
    });
    cy.intercept('POST', '**/users/logout', (request) => delayed.then(() => request.continue())).as('logout');
    cy.intercept('POST', '**/users/login').as('login');
    cy.get('[data-testid="settings-logout"]').click();
    cy.get('[data-testid="logout-confirm-submit"]').click();
    cy.location('pathname').should('eq', '/login');

    // A same-origin frame has its own app session, but shares cookies and Web Locks like another tab.
    let frame: HTMLIFrameElement;
    cy.window().then((win) => {
        frame = win.document.createElement('iframe');
        frame.src = '/login';
        frame.width = '500';
        frame.height = '800';
        win.document.body.append(frame);
    });
    const field = (id: string) =>
        cy
            .wrap(null)
            .should(() => {
                expect(frame.contentDocument?.querySelector(`[data-testid="${id}"]`)).not.to.be.null;
            })
            .then(() => cy.wrap(frame.contentDocument!).find(`[data-testid="${id}"]`));
    field('auth-email').type(b.email);
    field('auth-password').type(b.password);
    field('auth-submit').click();
    cy.window()
        .then((win) => win.navigator.locks.query())
        .then((locks) => {
            expect(locks.pending?.some((lock) => lock.name === 'tally-auth')).to.eq(true);
        });
    cy.get('@login.all').should('have.length', 0);
    cy.then(() => finish());
    cy.wait('@logout');
    cy.wait('@login').its('response.statusCode').should('eq', 200);
    field('home-settings-link').should('be.visible');
    cy.request('/users/check-auth').its('body.data.user.email').should('eq', b.email);
    cy.request('DELETE', '/users');
    cy.request('POST', '/users/login', a);
    cy.request('DELETE', '/users');
});
