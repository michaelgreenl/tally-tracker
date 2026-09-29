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
            cy.get('[data-testid="counter-members-list"]').should('have.css', 'border-top-width', '1px');
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
                        const amountElement = $row[0].querySelector(
                            `[data-testid="counter-member-${memberId}-amount"]`,
                        )!;
                        const amount = amountElement.getBoundingClientRect();
                        const window = $row[0].ownerDocument.defaultView!;
                        const ageElement = $row[0].querySelector(`[data-testid="counter-member-${memberId}-age"]`)!;
                        for (const label of [ageElement, amountElement]) {
                            expect(label.scrollWidth, 'action text is not clipped').to.be.at.most(label.clientWidth);
                        }
                        expect(window.getComputedStyle(amountElement).fontSize, 'matching action sizes').to.equal(
                            window.getComputedStyle(ageElement).fontSize,
                        );
                        expect(presence.left - name.right, 'even identity spacing').to.be.closeTo(16, 1);
                        expect(presence.top + presence.height / 2, 'presence stays on the row').to.be.closeTo(
                            name.top + name.height / 2,
                            1,
                        );
                        expect(age.top + age.height / 2, 'last action stays on the row').to.be.closeTo(
                            name.top + name.height / 2,
                            1,
                        );
                        expect(amount.left - age.right, 'amount follows the timestamp').to.be.closeTo(12, 1);
                        expect(amount.top + amount.height / 2, 'amount is centered in the row').to.be.closeTo(
                            bounds.top + bounds.height / 2,
                            1,
                        );
                        expect(amount.right, 'last action reaches the right edge').to.be.closeTo(bounds.right, 1);
                    });
                cy.get(`[data-testid="counter-member-${user.id}-owner"]`).should(($icon) => {
                    const icon = $icon[0].getBoundingClientRect();
                    const name = $icon[0].ownerDocument
                        .querySelector(`[data-testid="counter-member-${user.id}-username"]`)!
                        .getBoundingClientRect();
                    expect(icon.width, 'owner icon keeps its size').to.equal(20);
                    expect(name.left - icon.right, 'matching identity gaps').to.be.closeTo(16, 1);
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

    for (const isOwner of [true, false]) {
        it(
            isOwner
                ? 'confirms removal and retains the participant after a failed request'
                : 'does not offer removal to a participant',
            () => {
                signIn(`reader_${crypto.randomUUID().replaceAll('-', '')}`).then((user) => {
                    const counterId = crypto.randomUUID();
                    const ownerId = isOwner ? user.id : crypto.randomUUID();
                    const memberId = isOwner ? crypto.randomUUID() : user.id;
                    let removed = false;
                    let attempts = 0;
                    cy.intercept('GET', '**/counters', {
                        body: {
                            success: true,
                            data: {
                                counters: [
                                    {
                                        id: counterId,
                                        title: 'Water',
                                        count: 10,
                                        increment: 1,
                                        type: 'SHARED',
                                        userId: ownerId,
                                        shares: [{ userId: memberId, status: 'ACCEPTED' }],
                                    },
                                ],
                            },
                        },
                    });
                    cy.intercept('GET', `**/counters/${counterId}/members`, (req) =>
                        req.reply({
                            success: true,
                            data: [
                                { id: ownerId, username: 'Alex', isOwner: true, lastAction: null },
                                ...(removed
                                    ? []
                                    : [{ id: memberId, username: 'Jamie', isOwner: false, lastAction: null }]),
                            ],
                        }),
                    );
                    cy.intercept('DELETE', `**/counters/${counterId}/members/${memberId}`, (req) => {
                        if (++attempts === 1) req.reply({ statusCode: 503, body: { success: false } });
                        else {
                            removed = true;
                            req.reply({ success: true });
                        }
                    }).as('removeParticipant');
                    openHome(user);
                    cy.get(`[data-testid="counter-${counterId}-members"]`).click();
                    cy.get(`[data-testid="counter-member-${ownerId}"]`).should('have.attr', 'aria-disabled', 'true');
                    const row = `[data-testid="counter-member-${memberId}"]`;
                    if (!isOwner) {
                        cy.get(row).should('have.attr', 'aria-disabled', 'true');
                        cy.get('[data-testid="participant-remove-confirm"]').should('not.exist');
                        cy.get('@removeParticipant.all').should('have.length', 0);
                        return;
                    }
                    cy.get(row).trigger('mousedown', { eventConstructor: 'MouseEvent', button: 0, buttons: 1 });
                    cy.wait(600); // Exercise the long-press threshold, not a click.
                    cy.get(row).trigger('mouseup', {
                        eventConstructor: 'MouseEvent',
                        button: 0,
                        buttons: 0,
                        force: true,
                    });
                    cy.get('[data-testid="participant-remove-confirm"]').should('be.visible');
                    cy.get('[data-testid="participant-remove-cancel"]').click();
                    cy.get(row).should('be.visible');
                    cy.get('@removeParticipant.all').should('have.length', 0);
                    // Desktop activation reaches the same confirmation without a long press.
                    cy.get(row).focus().should('have.focus').click();
                    cy.get('[data-testid="participant-remove-confirm"]').should('be.visible');
                    cy.get('[data-testid="participant-remove-confirm"]').screenshot('participant-remove-confirm');
                    cy.get('[data-testid="participant-remove-submit"]').click();
                    cy.wait('@removeParticipant').its('response.statusCode').should('eq', 503);
                    cy.get('[data-testid="participant-remove-error"]').should('be.visible');
                    cy.get(row).should('exist');
                    cy.get('[data-testid="participant-remove-submit"]').click();
                    cy.wait('@removeParticipant').its('response.statusCode').should('eq', 200);
                    cy.get('[data-testid="participant-remove-confirm"]').should('not.exist');
                    cy.get(row).should('not.exist');
                    cy.get(`[data-testid="counter-member-${ownerId}"]`).should('be.visible');
                });
            },
        );
    }
});
