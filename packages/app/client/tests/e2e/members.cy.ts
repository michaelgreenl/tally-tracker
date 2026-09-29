/// <reference types="cypress" />

import type { ClientUser } from '@tally/core/client' with { 'resolution-mode': 'import' };

function signIn(username?: string): Cypress.Chainable<ClientUser> {
    const credentials = { email: `members-${crypto.randomUUID()}@example.com`, password: 'Member-password1' };
    cy.request('POST', '/users', credentials);
    return cy.request('POST', '/users/login', credentials).then(({ body }) => {
        if (username) return cy.request('POST', '/users/username', { username }).its('body.data.user');
        return cy.wrap(body.data.user as ClientUser, { log: false });
    });
}

function openHome(user: ClientUser) {
    cy.visit('/home', { onBeforeLoad: (win) => win.localStorage.setItem('auth_user_profile', JSON.stringify(user)) });
}

describe('Usernames and counter members', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
        cy.viewport(375, 812);
    });
    afterEach(() => {
        cy.request('DELETE', '/users');
    });

    it('validates locally, keeps a rejected choice editable, and remembers the saved username', () => {
        let available = false;
        cy.intercept('POST', '**/users/username', (req) => {
            if (available) req.continue();
            else req.reply({ statusCode: 409, body: { success: false, message: 'That username is taken.' } });
        }).as('username');
        signIn().then(openHome);
        cy.get('[data-testid="username-input"]').type('ab');
        cy.get('[data-testid="username-submit"]').click();
        cy.get('@username.all').should('have.length', 0);
        cy.get('[data-testid="username-input"]').clear().type('not valid');
        cy.get('[data-testid="username-submit"]').click();
        cy.get('@username.all').should('have.length', 0);
        cy.get('[data-testid="username-input"]').clear().type('Alex');
        cy.get('[data-testid="username-submit"]').click();
        cy.wait('@username').its('response.statusCode').should('eq', 409);
        cy.get('[data-testid="username-input"]').should('have.value', 'Alex').and('not.be.disabled');
        cy.get('[data-testid="username-error"]').should('be.visible');
        const username = `alex_${crypto.randomUUID().replaceAll('-', '')}`;
        cy.then(() => {
            available = true;
        });
        cy.get('[data-testid="username-input"]').clear().type(username);
        cy.get('[data-testid="username-submit"]').click();
        cy.wait('@username').its('response.body.data.user.username').should('eq', username);
        cy.get('[data-testid="username-setup"]').should('not.exist');
        cy.reload();
        cy.get('[data-testid="home-settings-link"]').should('be.visible');
        cy.get('[data-testid="username-setup"]').should('not.exist');
    });

    it('opens members and updates presence, action, and age without clipping narrow or landscape layouts', () => {
        const counterId = crypto.randomUUID();
        const memberId = crypto.randomUUID();
        const title = 'A shared reading counter with a long name';
        let online = true;
        let amount = 1;
        const now = Date.now();
        cy.clock(now, ['Date', 'setInterval', 'clearInterval']);
        signIn(`reader_${crypto.randomUUID().replaceAll('-', '')}`).then((user: ClientUser) => {
            cy.intercept('GET', '**/counters', {
                body: {
                    success: true,
                    data: {
                        counters: [
                            {
                                id: counterId,
                                title,
                                count: 10,
                                increment: 1,
                                metric: 'pages',
                                type: 'SHARED',
                                userId: user.id,
                                inviteCode: crypto.randomUUID(),
                                color: null,
                                shares: [{ userId: memberId, status: 'ACCEPTED' }],
                            },
                        ],
                    },
                },
            });
            cy.intercept('GET', '**/counters/presence', (req) =>
                req.reply({ success: true, data: online ? [user.id, memberId] : [user.id] }),
            );
            cy.intercept('GET', `**/counters/${counterId}/members`, (req) =>
                req.reply({
                    success: true,
                    data: [
                        { id: user.id, username: user.username, isOwner: true, lastAction: null },
                        {
                            id: memberId,
                            username: 'A_very_long_username_that_must_not_push_status_off_screen',
                            isOwner: false,
                            lastAction: { amount, at: new Date(now - 5000).toISOString() },
                        },
                    ],
                }),
            ).as('members');
            openHome(user);
            cy.get(`[data-testid="counter-${counterId}-presence"]`).should('have.attr', 'stroke', '#70c8e3');
            cy.get(`[data-testid="counter-${counterId}-members"]`).click();
            cy.wait('@members');
            const row = `[data-testid="counter-member-${memberId}"]`;
            cy.get(row).should('contain.text', '+1').and('contain.text', '5s ago').and('contain.text', 'Online');
            cy.tick(1000);
            cy.get(row).should('contain.text', '6s ago');
            for (const [width, height] of [
                [375, 812],
                [812, 375],
            ]) {
                cy.viewport(width, height);
                cy.get(row)
                    .scrollIntoView()
                    .should(($row) => {
                        const bounds = $row[0].getBoundingClientRect();
                        expect(bounds.left).to.be.at.least(0);
                        expect(bounds.right).to.be.at.most(width);
                        for (const child of Array.from($row[0].querySelectorAll('*'))) {
                            const box = child.getBoundingClientRect();
                            expect(box.right).to.be.at.most(bounds.right + 1);
                            expect(box.left).to.be.at.least(bounds.left - 1);
                        }
                    });
            }
            cy.viewport(375, 812);
            cy.get('[data-testid="counter-members-sheet"]').screenshot('counter-members');
            cy.then(() => {
                online = false;
                amount = -0.5;
            });
            // The real socket carries a membership invalidation to the mounted sheet.
            cy.request('POST', '/users/username', { username: user.username });
            cy.get(row).should('contain.text', '-0.5').and('contain.text', 'Offline');
            cy.get(`[data-testid="counter-${counterId}-presence"]`).should('have.attr', 'stroke', '#b8c0c8');
            cy.get('[data-testid="counter-members-close"]').click();
            cy.get('[data-testid="counter-members-sheet"]').should('not.exist');
        });
    });
});
