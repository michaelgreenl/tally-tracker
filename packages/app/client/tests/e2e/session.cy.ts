/// <reference types="cypress" />

for (const allDevices of [false, true]) {
    it(`uses the logout checkbox to select the sessions to end (all devices: ${allDevices})`, () => {
        cy.clearCookies();
        cy.clearLocalStorage();
        cy.viewport(allDevices ? 667 : 375, allDevices ? 375 : 812);
        const account = {
            email: `logout-choice-${crypto.randomUUID()}@example.com`,
            password: 'Abcdef12',
            rememberMe: true,
            username: `logout_${crypto.randomUUID().replaceAll('-', '')}`,
        };
        let otherDeviceToken: string;
        cy.request('POST', '/users', account);
        cy.request('POST', '/users/login', account).then(({ body }) => {
            otherDeviceToken = body.data.accessToken;
        });
        cy.request('POST', '/users/login', account).then(({ body }) => {
            cy.visit('/settings', {
                onBeforeLoad: (win) => win.localStorage.setItem('auth_user_profile', JSON.stringify(body.data.user)),
            });
        });
        cy.intercept('POST', '**/users/logout').as('logout');
        cy.get('[data-testid="settings-logout"]').click();
        cy.get('[data-testid="logout-all-devices"]').should('not.be.checked').check();
        cy.get('[data-testid="logout-cancel"]').click();
        cy.get('[data-testid="settings-logout"]').click();
        cy.get('[data-testid="logout-all-devices"]').should('not.be.checked');
        if (allDevices) cy.get('[data-testid="logout-all-devices"]').click().should('be.checked');
        cy.get('[data-testid="logout-confirm"]').screenshot(`logout-${allDevices ? 'all' : 'current'}-session`);
        cy.get('[data-testid="logout-confirm-submit"]').click();
        cy.wait('@logout').its('request.body.allDevices').should('eq', allDevices);
        cy.location('pathname').should('eq', '/login');
        cy.then(() =>
            cy.request({
                url: '/users/check-auth',
                headers: { Authorization: `Bearer ${otherDeviceToken}` },
                failOnStatusCode: false,
            }),
        )
            .its('status')
            .should('eq', allDevices ? 401 : 200);
        cy.request('POST', '/users/login', account);
        cy.request('DELETE', '/users');
    });
}

for (const action of ['logout', 'deletion'] as const) {
    it(`finishes account ${action} before a second browser context installs another account’s cookies`, () => {
        cy.clearCookies();
        cy.clearLocalStorage();
        const credentials = (name: string) => ({
            email: `${name}-${crypto.randomUUID()}@example.com`,
            password: 'New-password123',
            username: `session_${crypto.randomUUID().replaceAll('-', '')}`,
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
        cy.get(`[data-testid="settings-${action === 'logout' ? 'logout' : 'delete-account'}"]`).should('be.visible');

        // A same-origin frame has its own app session, but shares cookies and Web Locks like another tab.
        // Prepare it before holding the response; app startup is not part of the lock assertion.
        let frame: HTMLIFrameElement;
        cy.window().then((win) => {
            // Model a second context signing in without changing the first context's active session.
            win.localStorage.removeItem('auth_user_profile');
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
                    expect(frame.contentDocument?.querySelector(`[data-testid="${id}"]`)).to.exist;
                })
                .then(() => cy.wrap(frame.contentDocument!).find(`[data-testid="${id}"]`));
        field('auth-email').type(b.email);
        field('auth-password').type(b.password);

        let finish!: () => void;
        const delayed = new Cypress.Promise<void>((resolve) => {
            finish = resolve;
        });
        cy.intercept(
            action === 'logout' ? 'POST' : 'DELETE',
            action === 'logout' ? '**/users/logout' : '**/users',
            (request) => delayed.then(() => request.continue()),
        ).as('endSession');
        cy.intercept('POST', '**/users/login').as('login');
        cy.get(`[data-testid="settings-${action === 'logout' ? 'logout' : 'delete-account'}"]`).click();
        cy.get(`[data-testid="${action === 'logout' ? 'logout' : 'delete-account'}-confirm-submit"]`).click();
        if (action === 'logout') cy.location('pathname').should('eq', '/login');
        field('auth-submit').click();
        cy.window()
            .then((win) => win.navigator.locks.query())
            .then((locks) => {
                expect(locks.pending?.some((lock) => lock.name === 'tally-auth')).to.eq(true);
            });
        cy.get('@login.all').should('have.length', 0);
        cy.then(() => finish());
        cy.wait('@endSession');
        cy.wait('@login').its('response.statusCode').should('eq', 200);
        field('home-settings-link').should('be.visible');
        cy.request('/users/check-auth').its('body.data.user.email').should('eq', b.email);
        cy.request('DELETE', '/users');
        if (action === 'logout') {
            cy.request('POST', '/users/login', a);
            cy.request('DELETE', '/users');
        }
    });
}

it('refreshes expired access before deleting an account without holding its own browser lock', () => {
    cy.clearCookies();
    cy.clearLocalStorage();
    const account = {
        email: `delete-${crypto.randomUUID()}@example.com`,
        password: 'New-password123',
        rememberMe: true,
        username: `delete_${crypto.randomUUID().replaceAll('-', '')}`,
    };
    cy.request('POST', '/users', account);
    cy.request('POST', '/users/login', account).then(({ body }) => {
        cy.visit('/settings', {
            onBeforeLoad: (win) => win.localStorage.setItem('auth_user_profile', JSON.stringify(body.data.user)),
        });
    });
    cy.get('[data-testid="settings-delete-account"]').should('be.visible');
    cy.intercept('POST', '**/users/refresh').as('refresh');
    let firstDeletion = true;
    cy.intercept('DELETE', '**/users', (request) => {
        // Expire this request only; background sync must not refresh the fixture before deletion starts.
        if (firstDeletion) {
            firstDeletion = false;
            request.headers.cookie = String(request.headers.cookie).replace(
                /(^|;\s*)access_token=[^;]*/,
                '$1access_token=expired-fixture-token',
            );
        }
        request.continue();
    }).as('deletion');
    cy.get('[data-testid="settings-delete-account"]').click();
    cy.get('[data-testid="delete-account-confirm-submit"]').click();
    cy.wait('@deletion').its('response.statusCode').should('eq', 401);
    cy.wait('@refresh').its('response.statusCode').should('eq', 200);
    cy.wait('@deletion').its('response.statusCode').should('eq', 200);
    cy.location('pathname').should('eq', '/login');
    cy.request({ method: 'POST', url: '/users/login', body: account, failOnStatusCode: false })
        .its('status')
        .should('eq', 401);
});
