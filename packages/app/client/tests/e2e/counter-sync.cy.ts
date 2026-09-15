/// <reference types="cypress" />

import type { ClientCounter, ClientUser } from '@tally/core/client';

function openAccount(user: ClientUser) {
    cy.visit('/home', {
        onBeforeLoad(win) {
            win.localStorage.setItem('auth_user_profile', JSON.stringify(user));
        },
    });
    cy.get('[data-testid="home-sync-status"]').should('have.text', 'Synced');
}

describe('Counter sync recovery', () => {
    let user: ClientUser;

    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
        const credentials = { email: `sync-${crypto.randomUUID()}@example.com`, password: 'Password123' };
        cy.request('POST', '/users', credentials);
        cy.request('POST', '/users/login', credentials).then(({ body }) => {
            user = body.data.user;
            openAccount(user);
        });
    });

    afterEach(() => {
        cy.request('DELETE', '/users');
    });

    it('keeps rejected writes through reload and syncs them once the API recovers', () => {
        let available = false;
        let counterId = '';
        cy.intercept('POST', '**/counters', (request) => {
            request.alias = available ? 'created' : 'rejected';
            if (available) request.continue();
            else request.reply({ statusCode: 422, body: { success: false, message: 'Unsupported fields' } });
        });
        cy.get('[data-testid="add-counter-button"]').click();
        cy.get('[data-testid="counter-title"]').type('Water');
        cy.get('[data-testid="counter-metric"]').type('16oz bottle');
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.wait('@rejected').then(({ request }) => {
            counterId = request.body.id;
            cy.get(`[data-testid="counter-${counterId}-increase"]`).click();
        });
        cy.get('[data-testid="home-sync-status"]').should('have.text', 'Sync failed');
        cy.reload();
        cy.get('[data-testid="home-sync-status"]').should('have.text', 'Sync failed');
        cy.then(() => {
            cy.get(`[data-testid="counter-${counterId}-count"]`).should('have.text', '1');
        });
        cy.window().should((win) => {
            const queue = JSON.parse(win.localStorage.getItem('app_sync_queue') || '[]');
            expect(queue.map((item: { type: string }) => item.type)).to.deep.equal(['CREATE', 'INCREMENT']);
        });

        cy.then(() => {
            available = true;
        });
        cy.reload();
        cy.wait('@created').its('response.statusCode').should('eq', 201);
        cy.get('[data-testid="home-sync-status"]').should('have.text', 'Synced');
        cy.request('GET', '/counters').then(({ body }) => {
            expect(body.data.counters).to.have.length(1);
            expect(body.data.counters[0]).to.include({ id: counterId, count: 1, metric: '16oz bottle' });
        });
        cy.window().should((win) => {
            expect(JSON.parse(win.localStorage.getItem('app_sync_queue') || '[]')).to.deep.equal([]);
        });
        cy.clearLocalStorage();
        cy.then(() => openAccount(user));
        cy.then(() => {
            cy.get(`[data-testid="counter-${counterId}-count"]`).should('have.text', '1');
            cy.get(`[data-testid="counter-${counterId}-metric"]`).should('have.text', '16oz bottle');
        });
    });

    it('receives a counter created in another session without reloading', () => {
        cy.request('POST', '/counters', { title: 'From phone', metric: 'bottle', increment: 0.5, count: 2 }).then(
            ({ body }) => {
                const counter: ClientCounter = body.data.counter;
                cy.get(`[data-testid="counter-${counter.id}-count"]`).should('have.text', '2');
                cy.get(`[data-testid="counter-${counter.id}-metric"]`).should('have.text', 'bottle');
                cy.request('PUT', `/counters/update/${counter.id}`, { title: 'Renamed on phone', metric: 'cup' });
                cy.get(`[data-testid="counter-${counter.id}-title"]`).should('have.text', 'Renamed on phone');
                cy.get(`[data-testid="counter-${counter.id}-metric"]`).should('have.text', 'cup');
            },
        );
    });
});
