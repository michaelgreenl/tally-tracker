/// <reference types="cypress" />

const expectOrder = (ids: string[]) =>
    cy.get('[data-testid="counter-list"] [data-testid$="-drag"]').should(($rows) => {
        expect([...$rows].map((element) => element.dataset.testid)).to.deep.equal(
            ids.map((id) => `counter-${id}-drag`),
        );
    });

describe('Counter order', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
        cy.viewport(440, 956);
    });

    it('enables Reorder only after there is another counter to move', () => {
        cy.visit('/home');
        for (const title of ['First', 'Second']) {
            cy.get('[data-testid="add-counter-button"]').click();
            cy.get('[data-testid="counter-title"]').type(title);
            cy.get('[data-testid="counter-form-submit"]').click();
            cy.get('[data-testid$="-menu"]').first().click();
            cy.get('[data-testid$="-reorder"]')
                .first()
                .should(title === 'First' ? 'be.disabled' : 'be.enabled');
            cy.get('[data-testid$="-menu"]').first().click();
        }
        cy.get('[data-testid$="-menu"]').first().click();
        cy.get('[data-testid$="-reorder"]').first().click();
        cy.get('[data-testid="counter-reorder-done"]').should('be.visible');
    });

    it('fills the viewport behind the add button and scrolls the last card clear of it', () => {
        cy.viewport(390, 320);
        cy.visit('/home');
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-title"]').type('Last counter');
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.get('[data-testid="counter-list"]')
            .should(($list) => {
                expect($list[0].getBoundingClientRect().bottom, 'list reaches viewport bottom').to.be.closeTo(320, 1);
            })
            .scrollTo('bottom');
        cy.get('[data-testid="add-counter-button"]').then(($button) => {
            cy.get('[data-testid$="-drag"]')
                .last()
                .should(($row) => {
                    expect(
                        $row[0].getBoundingClientRect().bottom,
                        'last card clears the floating button',
                    ).to.be.at.most($button[0].getBoundingClientRect().top);
                });
        });
    });

    it('cancels the draft order without changing the saved order', () => {
        const counters = ['first', 'second', 'third'].map((id) => ({
            id,
            title: id,
            userId: 'guest',
            count: 0,
            increment: 1,
            metric: null,
            type: 'PERSONAL',
            color: '#000000',
            inviteCode: null,
        }));
        const savedOrder = ['third', 'first', 'second'];
        cy.visit('/home', {
            onBeforeLoad(win) {
                win.localStorage.setItem('app_counters', JSON.stringify(counters));
                win.localStorage.setItem('app_counters_order_guest', JSON.stringify(savedOrder));
            },
        });
        cy.get('[data-testid="counter-third-menu"]').click();
        cy.get('[data-testid="counter-third-reorder"]').click();
        cy.get('[data-testid="tally-brand"]').should('not.exist');
        cy.get('[data-testid="counter-third-drag"]').focus().type('{downarrow}{downarrow}');
        expectOrder(['first', 'second', 'third']);
        cy.window().should((win) => {
            expect(JSON.parse(win.localStorage.getItem('app_counters_order_guest')!)).to.deep.equal(savedOrder);
        });
        cy.get('[data-testid="counter-reorder-cancel"]').click();
        cy.get('[data-testid="counter-reorder-done"]').should('not.exist');
        cy.get('[data-testid="tally-brand"]').should('be.visible');
        expectOrder(savedOrder);
        cy.reload();
        expectOrder(savedOrder);
    });

    for (const mode of ['long press', 'reorder menu']) {
        it(`drags using ${mode}, preserves counts, and restores guest order after reload`, () => {
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
                if (mode === 'reorder menu') {
                    cy.get(`[data-testid="counter-${ids[0]}-menu"]`).click();
                    cy.get(`[data-testid="counter-${ids[0]}-reorder"]`).click();
                    cy.get('[data-testid="counter-reorder-done"]').should('be.visible');
                    cy.get('[data-testid="counter-list"]').find('[role="button"], button, input').should('not.exist');
                    cy.get('[data-testid$="-drag"]').should('have.attr', 'role', 'slider');
                }

                cy.get(`[data-testid="counter-${ids[0]}-drag"]`).then(($first) => {
                    cy.get(`[data-testid="counter-${ids[2]}-drag"]`).then(($last) => {
                        const first = $first[0].getBoundingClientRect();
                        const last = $last[0].getBoundingClientRect();
                        const pointer = {
                            eventConstructor: 'PointerEvent',
                            pointerId: 1,
                            pointerType: 'mouse',
                            button: 0,
                            buttons: 1,
                            clientX: first.left + 30,
                        };
                        // Start on the heading; the count at the row's center is an edit button.
                        const pressTarget = `counter-${ids[0]}-${mode === 'long press' ? 'title' : 'drag'}`;
                        cy.get(`[data-testid="${pressTarget}"]`).trigger('pointerdown', {
                            ...pointer,
                            clientY: first.top + 30,
                        });
                        cy.get(`[data-testid="${pressTarget}"]`).trigger('mousedown', {
                            ...pointer,
                            eventConstructor: 'MouseEvent',
                            clientY: first.top + 30,
                        });
                        // Hold past the press gesture's 500ms threshold before moving.
                        if (mode === 'long press') cy.wait(600);
                        for (let step = 1; step <= 12; step++) {
                            cy.wrap($first).trigger('pointermove', {
                                ...pointer,
                                clientY: first.top + 30 + ((last.top - first.top + 30) * step) / 12,
                                force: true,
                            });
                            cy.window().then(
                                (win) =>
                                    new Cypress.Promise<void>((resolve) => win.requestAnimationFrame(() => resolve())),
                            );
                        }
                        cy.get('[data-testid="counter-drop-indicator"]').should(($indicator) => {
                            const outline = $indicator[0].getBoundingClientRect();
                            const addedWidth = $first[0].getBoundingClientRect().width - first.width;
                            const offset = addedWidth * 1.5;
                            expect(
                                outline.left,
                                'drop outline shifts left by 1.5 times the card’s growth',
                            ).to.be.closeTo(first.left - offset, 1);
                            expect(outline.right, 'drop outline keeps the card’s original width').to.be.closeTo(
                                first.right - offset,
                                1,
                            );
                        });
                        cy.wrap($first).trigger('pointerup', {
                            ...pointer,
                            buttons: 0,
                            clientY: last.top + 60,
                            force: true,
                        });
                        cy.wrap($first).trigger('mouseup', {
                            ...pointer,
                            eventConstructor: 'MouseEvent',
                            buttons: 0,
                            clientY: last.top + 60,
                            force: true,
                        });
                    });
                });
                expectOrder([ids[1], ids[2], ids[0]]);
                if (mode === 'reorder menu') cy.get('[data-testid="counter-reorder-done"]').click();
                cy.get(`[data-testid="counter-${ids[0]}-increase"]`)
                    .should('not.have.attr', 'aria-disabled', 'true')
                    .click();
                cy.reload();
                expectOrder([ids[1], ids[2], ids[0]]);
                cy.get(`[data-testid="counter-${ids[0]}-count"]`).should('have.text', '2');
            });
        });
    }

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
        cy.get('[data-testid="counter-first-reorder"]').click();
        cy.get('[data-testid="home-settings-link"]').should('not.exist');
        cy.get('[data-testid="counter-first-drag"]').focus().type(' {enter}{downarrow}');
        expectOrder(['second', 'first']);
        cy.get('[data-testid="counter-first-drag"]').should('have.attr', 'aria-valuenow', '2');
        cy.get('[data-testid="counter-reorder-done"]').click();
        cy.get('[data-testid="home-settings-link"]').should('be.visible');

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
        const counters = Array.from({ length: 20 }, (_, index) => ({
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
        cy.get('[data-testid="counter-scroll-0-menu"]').click();
        cy.get('[data-testid="counter-scroll-0-reorder"]').click();
        cy.get('[data-testid="counter-scroll-0-drag"]')
            .should('have.attr', 'tabindex', '0')
            .then(($row) => {
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
                    cy.window().then(async (win) => {
                        const startedAt = win.performance.now();
                        for (let step = 1; step <= 32; step++) {
                            const event = new win.PointerEvent('pointermove', {
                                ...pointer,
                                bubbles: true,
                                cancelable: true,
                                clientY: start.top + 30 + ((end - start.top - 30) * step) / 32,
                            });
                            // Model continuous input; CI delays must not reset the gesture's velocity.
                            Object.defineProperty(event, 'timeStamp', { value: startedAt + step * 16 });
                            $row[0].dispatchEvent(event);
                            await new Cypress.Promise<void>((resolve) => win.requestAnimationFrame(() => resolve()));
                        }
                    });
                    cy.wrap($list).should(($scroll) => expect($scroll[0].scrollTop).to.be.greaterThan(300));
                    cy.wrap($row).trigger('pointerup', { ...pointer, buttons: 0, clientY: end, force: true });
                    cy.wrap($row).trigger('mouseup', {
                        ...pointer,
                        eventConstructor: 'MouseEvent',
                        buttons: 0,
                        clientY: end,
                        force: true,
                    });
                    cy.get('[data-testid="counter-scroll-0-drag"]').should(($settled) => {
                        expect(Number($settled.attr('aria-valuenow'))).to.be.greaterThan(4);
                    });
                    cy.get('[data-testid="counter-reorder-done"]').click();
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
