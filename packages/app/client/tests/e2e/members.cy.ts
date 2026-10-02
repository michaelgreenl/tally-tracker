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

function swipeLeft(memberId: string, distance = 0.4) {
    cy.get(`[data-testid="counter-member-${memberId}"]`).then(($row) => {
        const bounds = $row[0].getBoundingClientRect();
        const pointer = {
            eventConstructor: 'PointerEvent',
            pointerId: 1,
            pointerType: 'touch',
            button: 0,
            buttons: 1,
            clientY: bounds.top + bounds.height / 2,
        };
        cy.wrap($row).trigger('pointerdown', { ...pointer, clientX: bounds.right - 24 });
        for (let step = 1; step <= 12; step++) {
            cy.wrap($row).trigger('pointermove', {
                ...pointer,
                clientX: bounds.right - 24 - (bounds.width * distance * step) / 12,
                force: true,
            });
            cy.window().then(
                (win) => new Cypress.Promise<void>((resolve) => win.requestAnimationFrame(() => resolve())),
            );
        }
        cy.wrap($row).trigger('pointerup', {
            ...pointer,
            buttons: 0,
            clientX: bounds.right - 24 - bounds.width * distance,
            force: true,
        });
    });
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
        let releaseMembers: (() => void) | undefined;
        let holdMembers = true;
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
            cy.intercept('GET', `**/counters/${counterId}/members`, (req) => {
                const reply = () =>
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
                    });
                if (!holdMembers) return reply();
                holdMembers = false;
                return new Promise<void>((resolve) => {
                    releaseMembers = () => {
                        reply();
                        resolve();
                    };
                });
            }).as('members');
            openHome(user);
            cy.get(`[data-testid="counter-${counterId}-presence"]`).should('have.attr', 'stroke', '#70c8e3');
            cy.get(`[data-testid="counter-${counterId}-members"]`).click();
            cy.get('[data-testid="counter-members-list"]').should('have.css', 'opacity', '1');
            cy.get('[data-testid="counter-members-dialog"]').then(($dialog) => {
                const dialog = $dialog[0];
                const win = dialog.ownerDocument.defaultView!;
                const initialHeight = dialog.getBoundingClientRect().height;
                let middleHeight: number | undefined;
                let middleOpacity: number | undefined;
                return new Cypress.Promise<void>((resolve) => {
                    const sample = (event: AnimationEvent) => {
                        const target = event.target as HTMLElement;
                        if (
                            target !== dialog &&
                            !(
                                target.dataset.testid === 'counter-members-list' &&
                                target.querySelector(`[data-testid="counter-member-${memberId}"]`)
                            )
                        )
                            return;
                        const animation = target
                            .getAnimations()
                            .find((animation) => (animation as CSSAnimation).animationName === event.animationName);
                        if (!animation?.effect) return;
                        const timing = animation.effect.getTiming();
                        const currentTime = animation.currentTime;
                        // Sample the rendered midpoint without relying on the machine's frame rate.
                        animation.pause();
                        animation.currentTime = (timing.delay ?? 0) + Number(timing.duration) / 2;
                        if (target === dialog) middleHeight = dialog.getBoundingClientRect().height;
                        else middleOpacity = Number(win.getComputedStyle(target).opacity);
                        animation.currentTime = currentTime;
                        animation.play();
                        if (middleHeight !== undefined && middleOpacity !== undefined) {
                            dialog.removeEventListener('animationstart', sample);
                            resolve();
                        }
                    };
                    dialog.addEventListener('animationstart', sample);
                    releaseMembers!();
                }).then(() => {
                    expect(middleHeight, 'popup grows instead of snapping').to.be.within(
                        initialHeight + 1,
                        dialog.offsetHeight - 1,
                    );
                    expect(middleOpacity, 'participant rows fade into view').to.be.within(0.01, 0.99);
                });
            });
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
                    const close = $dialog[0]
                        .querySelector('[data-testid="counter-members-close"]')!
                        .getBoundingClientRect();
                    const list = $dialog[0]
                        .querySelector('[data-testid="counter-members-list"]')!
                        .getBoundingClientRect();
                    expect(list.top - close.bottom, 'header has four extra points below it').to.be.closeTo(20, 1);
                });
                cy.get(row)
                    .scrollIntoView()
                    .should(($row) => {
                        const bounds = $row[0].getBoundingClientRect();
                        expect(bounds.height, 'rows leave room above and below their content').to.be.at.least(64);
                        expect(bounds.left).to.be.at.least(0);
                        expect(bounds.right).to.be.at.most(width);
                        for (const child of Array.from($row[0].querySelectorAll('*'))) {
                            if (!child.getClientRects().length) continue;
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
                        expect(name.left - presence.right, 'presence sits close to the username').to.be.closeTo(8, 1);
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
                    expect(icon.left - name.right, 'owner follows the username').to.be.closeTo(8, 1);
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
                ? 'reveals removal with a swipe, confirms it, and retains the participant after a failed request'
                : 'does not offer removal to a participant',
            () => {
                signIn(`reader_${crypto.randomUUID().replaceAll('-', '')}`).then((user) => {
                    const counterId = crypto.randomUUID();
                    const ownerId = isOwner ? user.id : crypto.randomUUID();
                    const memberId = isOwner ? crypto.randomUUID() : user.id;
                    const otherMemberId = crypto.randomUUID();
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
                                        shares: [memberId, otherMemberId].map((userId) => ({
                                            userId,
                                            status: 'ACCEPTED',
                                        })),
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
                                { id: otherMemberId, username: 'Taylor', isOwner: false, lastAction: null },
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
                    cy.get(`[data-testid="counter-member-${user.id}-username"]`).should(
                        'have.css',
                        'font-weight',
                        '700',
                    );
                    cy.get(`[data-testid="counter-member-${isOwner ? memberId : ownerId}-username"]`).should(
                        'have.css',
                        'font-weight',
                        '600',
                    );
                    const row = `[data-testid="counter-member-${memberId}"]`;
                    const remove = `[data-testid="counter-member-${memberId}-remove"]`;
                    swipeLeft(ownerId);
                    cy.get(`[data-testid="counter-member-${ownerId}-remove"]`).should('not.exist');
                    if (!isOwner) {
                        for (const id of [memberId, otherMemberId]) {
                            swipeLeft(id);
                            cy.get(`[data-testid="counter-member-${id}-remove"]`).should('not.exist');
                        }
                        cy.get('[data-testid="participant-remove-confirm"]').should('not.exist');
                        cy.get('@removeParticipant.all').should('have.length', 0);
                        return;
                    }
                    swipeLeft(memberId);
                    cy.get(remove).should(($button) => {
                        const button = $button[0].getBoundingClientRect();
                        const content = $button[0].ownerDocument.querySelector(row)!.getBoundingClientRect();
                        expect(button.width, 'remove has a usable touch width').to.be.at.least(48);
                        expect(button.height, 'remove has a usable touch height').to.be.at.least(48);
                        expect(button.left - content.right, 'remove has space beside the row content').to.be.closeTo(
                            8,
                            1,
                        );
                        expect(button.top - content.top, 'remove has space above it').to.be.closeTo(8, 1);
                        expect(content.bottom - button.bottom, 'remove has space below it').to.be.closeTo(8, 1);
                        expect(
                            parseFloat(getComputedStyle($button[0]).borderRadius),
                            'remove is rounded',
                        ).to.be.at.least(button.height / 2);
                    });
                    cy.get('[data-testid="counter-members-dialog"]').screenshot('participant-swipe-remove');
                    // A short swipe reveals Remove without opening confirmation or sending a request.
                    cy.get('[data-testid="participant-remove-confirm"]').should('not.exist');
                    cy.get('@removeParticipant.all').should('have.length', 0);
                    cy.get(remove).click();
                    cy.get('[data-testid="participant-remove-confirm"]').should('be.visible');
                    cy.get('[data-testid="participant-remove-cancel"]').click();
                    cy.get(row).should('be.visible');
                    cy.get('@removeParticipant.all').should('have.length', 0);
                    cy.get(row).click('right');
                    cy.get(row).should(($row) => {
                        const list = $row[0].ownerDocument.querySelector('[data-testid="counter-members-list"]')!;
                        expect(
                            $row[0].getBoundingClientRect().right,
                            'tapping the row closes its action',
                        ).to.be.closeTo(list.getBoundingClientRect().right, 1);
                    });
                    swipeLeft(memberId, 0.8);
                    cy.get('[data-testid="participant-remove-confirm"]').should('be.visible');
                    cy.get('@removeParticipant.all').should('have.length', 0);
                    cy.get('[data-testid="participant-remove-cancel"]').click();
                    // Keyboard focus reveals the same action without a swipe gesture.
                    cy.get(remove).focus().should('have.focus');
                    for (const type of ['keyDown', 'keyUp']) {
                        cy.then(() =>
                            Cypress.automation('remote:debugger:protocol', {
                                command: 'Input.dispatchKeyEvent',
                                params: { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
                            }),
                        );
                    }
                    cy.get('[data-testid="participant-remove-confirm"]').should('be.visible');
                    cy.get('[data-testid="participant-remove-submit"]').should(
                        'have.css',
                        'background-color',
                        'rgb(180, 35, 24)',
                    );
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
                    cy.get(`[data-testid="counter-member-${otherMemberId}"]`).should('be.visible');
                });
            },
        );
    }
});
