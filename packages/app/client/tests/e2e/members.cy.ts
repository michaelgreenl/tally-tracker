/// <reference types="cypress" />

import type { ClientUser } from '@tally/core/client' with { 'resolution-mode': 'import' };

function signIn(username: string): Cypress.Chainable<ClientUser> {
    const credentials = { email: `members-${crypto.randomUUID()}@example.com`, password: 'Member-password1', username };
    cy.request('POST', '/users', credentials);
    return cy.request('POST', '/users/login', credentials).then(({ body }) => {
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

    it('opens a centered member popup with single rows and timestamps fixed until reopened', () => {
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
            cy.get(row).should('contain.text', '+1').and('contain.text', '5s ago');
            cy.get(`[data-testid="counter-member-${memberId}-presence"]`)
                .should('have.attr', 'aria-label', 'Online')
                .and('have.css', 'background-color', 'rgb(74, 222, 128)');
            cy.tick(1000);
            cy.get(row).should('contain.text', '5s ago');
            for (const [width, height] of [
                [375, 812],
                [812, 375],
            ]) {
                cy.viewport(width, height);
                cy.get('[data-testid="counter-members-dialog"]').should(($dialog) => {
                    const box = $dialog[0].getBoundingClientRect();
                    expect(box.top + box.height / 2, 'popup is vertically centered').to.be.closeTo(height / 2, 1);
                });
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
                        const name = $row[0]
                            .querySelector(`[data-testid="counter-member-${memberId}-username"]`)!
                            .getBoundingClientRect();
                        const presence = $row[0]
                            .querySelector(`[data-testid="counter-member-${memberId}-presence"]`)!
                            .getBoundingClientRect();
                        const age = $row[0]
                            .querySelector(`[data-testid="counter-member-${memberId}-age"]`)!
                            .getBoundingClientRect();
                        expect(presence.left - name.right, 'presence is beside the username').to.be.within(4, 8);
                        expect(presence.top + presence.height / 2, 'presence stays on the row').to.be.closeTo(
                            name.top + name.height / 2,
                            1,
                        );
                        expect(age.top + age.height / 2, 'last action stays on the row').to.be.closeTo(
                            name.top + name.height / 2,
                            1,
                        );
                        expect(age.right, 'last action reaches the right edge').to.be.closeTo(bounds.right, 1);
                    });
            }
            cy.viewport(375, 812);
            cy.get('[data-testid="counter-members-dialog"]').screenshot('counter-members');
            cy.then(() => {
                online = false;
                amount = -0.5;
            });
            // The real socket carries a membership invalidation to the mounted popup.
            cy.request('POST', '/users/username', { username: user.username });
            cy.get(row).should('contain.text', '-0.5').and('contain.text', '5s ago');
            cy.get(`[data-testid="counter-member-${memberId}-presence"]`).should('have.attr', 'aria-label', 'Offline');
            cy.get(`[data-testid="counter-${counterId}-presence"]`).should('have.attr', 'stroke', '#b8c0c8');
            cy.get('[data-testid="counter-members-close"]').click();
            cy.get('[data-testid="counter-members-dialog"]').should('not.exist');
            cy.get(`[data-testid="counter-${counterId}-members"]`).click();
            cy.wait('@members');
            cy.get(row).should('contain.text', '6s ago');
        });
    });
});
