/// <reference types="cypress" />

const expectOrder = (ids: string[]) =>
    cy.get('[data-testid="counter-list"] [data-testid$="-count"]').should(($counts) => {
        expect([...$counts].map((element) => element.dataset.testid)).to.deep.equal(
            ids.map((id) => `counter-${id}-count`),
        );
    });

describe('Counter order', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
        cy.viewport(440, 956);
    });

    it('moves a card after a long press, preserves counts, and restores guest order after reload', () => {
        cy.visit('/home');
        for (const title of ['First', 'Second', 'Third']) {
            cy.get('[data-testid="add-counter-button"]').click();
            cy.get('[data-testid="counter-title"]').type(title);
            cy.get('[data-testid="counter-form-submit"]').click();
        }
        cy.get('[data-testid$="-drag"]').then(($rows) => {
            const ids = [...$rows].map((row) => row.dataset.testid!.slice(8, -5));
            cy.get(`[data-testid="counter-${ids[0]}-increase"]`).click();
            expectOrder(ids);
            cy.get(`[data-testid="counter-${ids[0]}-count"]`).should('have.text', '1');

            const first = $rows[0].getBoundingClientRect();
            const last = $rows[2].getBoundingClientRect();
            const pointer = {
                eventConstructor: 'PointerEvent',
                pointerId: 1,
                pointerType: 'mouse',
                button: 0,
                buttons: 1,
                clientX: first.left + 30,
            };
            cy.wrap($rows[0]).trigger('pointerdown', { ...pointer, clientY: first.top + 30 });
            cy.wrap($rows[0]).trigger('mousedown', {
                ...pointer,
                eventConstructor: 'MouseEvent',
                clientY: first.top + 30,
            });
            // Exercise the actual long-press threshold, rather than calling the reorder handler.
            cy.wait(600);
            for (let step = 1; step <= 12; step++) {
                cy.wrap($rows[0]).trigger('pointermove', {
                    ...pointer,
                    clientY: first.top + 30 + ((last.top - first.top + 30) * step) / 12,
                    force: true,
                });
                cy.window().then(
                    (win) => new Cypress.Promise<void>((resolve) => win.requestAnimationFrame(() => resolve())),
                );
            }
            cy.wrap($rows[0]).trigger('pointerup', { ...pointer, buttons: 0, clientY: last.top + 60, force: true });
            cy.wrap($rows[0]).trigger('mouseup', {
                ...pointer,
                eventConstructor: 'MouseEvent',
                buttons: 0,
                clientY: last.top + 60,
                force: true,
            });
            expectOrder([ids[1], ids[2], ids[0]]);
            cy.reload();
            expectOrder([ids[1], ids[2], ids[0]]);
            cy.get(`[data-testid="counter-${ids[0]}-count"]`).should('have.text', '1');
        });
    });

    it('keeps each account’s order through server refreshes, with current values and new counters', () => {
        const counters = ['first', 'second', 'third'].map((id) => ({
            id,
            title: id,
            userId: 'owner',
            count: 0,
            type: 'SHARED',
            color: '#000000',
            inviteCode: null,
        }));
        const openAccount = (id: string) => {
            const user = { id, email: `${id}@example.com`, tier: 'PREMIUM', emailVerified: true };
            cy.intercept('GET', '**/users/check-auth', { body: { success: true, data: { user } } });
            cy.visit('/home', {
                onBeforeLoad(win) {
                    win.localStorage.setItem('auth_user_profile', JSON.stringify(user));
                },
            });
        };
        cy.intercept('GET', '**/counters', { body: { success: true, data: { counters: counters.slice(0, 2) } } });
        openAccount('person-one');
        cy.get('[data-testid="counter-first-menu"]').click();
        cy.get('[data-testid="counter-first-move-up"]').should('be.disabled');
        cy.get('[data-testid="counter-first-move-down"]').click();
        expectOrder(['second', 'first']);

        counters[0].count = 8;
        cy.intercept('GET', '**/counters', { body: { success: true, data: { counters } } });
        cy.reload();
        expectOrder(['second', 'first', 'third']);
        cy.get('[data-testid="counter-first-count"]').should('have.text', '8');
        openAccount('person-two');
        expectOrder(['first', 'second', 'third']);
        openAccount('person-one');
        expectOrder(['second', 'first', 'third']);
    });

    it('scrolls at the edge while dragging a card beyond the visible rows', () => {
        const user = { id: 'scroll-user', email: 'scroll@example.com', tier: 'PREMIUM', emailVerified: true };
        const counters = Array.from({ length: 12 }, (_, index) => ({
            id: `scroll-${index}`,
            title: `Counter ${index}`,
            userId: user.id,
            count: index,
            type: 'PERSONAL',
            color: '#000000',
            inviteCode: null,
        }));
        cy.intercept('GET', '**/users/check-auth', { body: { success: true, data: { user } } });
        cy.intercept('GET', '**/counters', { body: { success: true, data: { counters } } });
        cy.visit('/home', {
            onBeforeLoad(win) {
                win.localStorage.setItem('auth_user_profile', JSON.stringify(user));
            },
        });
        cy.get('[data-testid="counter-scroll-0-drag"]').then(($row) => {
            cy.get('[data-testid="counter-list"]').then(($list) => {
                const start = $row[0].getBoundingClientRect();
                const end = $list[0].getBoundingClientRect().bottom - 20;
                const pointer = {
                    eventConstructor: 'PointerEvent',
                    pointerId: 1,
                    pointerType: 'mouse',
                    button: 0,
                    buttons: 1,
                    clientX: start.left + 30,
                };
                cy.wrap($row).trigger('pointerdown', { ...pointer, clientY: start.top + 30 });
                cy.wrap($row).trigger('mousedown', {
                    ...pointer,
                    eventConstructor: 'MouseEvent',
                    clientY: start.top + 30,
                });
                cy.wait(600);
                for (let step = 1; step <= 12; step++) {
                    cy.wrap($row).trigger('pointermove', {
                        ...pointer,
                        clientY: start.top + 30 + ((end - start.top - 30) * step) / 12,
                        force: true,
                    });
                    cy.window().then(
                        (win) => new Cypress.Promise<void>((resolve) => win.requestAnimationFrame(() => resolve())),
                    );
                }
                cy.wrap($list).should(($scroll) => expect($scroll[0].scrollTop).to.be.greaterThan(300));
                cy.wrap($row).trigger('pointerup', { ...pointer, buttons: 0, clientY: end, force: true });
                cy.wrap($row).trigger('mouseup', {
                    ...pointer,
                    eventConstructor: 'MouseEvent',
                    buttons: 0,
                    clientY: end,
                    force: true,
                });
                cy.window().should((win) => {
                    const order: string[] = JSON.parse(
                        win.localStorage.getItem('app_counters_order_scroll-user') || '[]',
                    );
                    expect(order.indexOf('scroll-0')).to.be.greaterThan(3);
                    expect(order).to.have.members(counters.map((counter) => counter.id));
                });
            });
        });
    });
});
