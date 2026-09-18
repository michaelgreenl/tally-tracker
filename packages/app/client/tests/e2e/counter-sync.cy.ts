/// <reference types="cypress" />

import type { ClientCounter, ClientUser } from '@tally/core/client';

function openAccount(user: ClientUser) {
    cy.visit('/home', {
        onBeforeLoad(win) {
            win.localStorage.setItem('auth_user_profile', JSON.stringify(user));
        },
    });
    cy.get('[data-testid="home-sync-synced-icon"]').should('be.visible');
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

    it('shows a spinner while sync is pending and replaces it when sync finishes', () => {
        let finishSync!: () => void;
        const response = new Cypress.Promise<void>((resolve) => {
            finishSync = resolve;
        });
        cy.intercept('GET', '**/counters', (request) => response.then(() => request.continue())).as('sync');

        cy.reload();
        cy.get('[data-testid="home-sync-spinner"]').should('be.visible');
        cy.get('[data-testid="home-sync-synced-icon"]').should('not.exist');
        cy.then(() => finishSync());
        cy.wait('@sync');
        cy.get('[data-testid="home-sync-spinner"]').should('not.exist');
        cy.get('[data-testid="home-sync-synced-icon"]').should('be.visible');
    });

    it('repairs a rejected creation after cache loss without losing or duplicating queued taps', () => {
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
        cy.get('[data-testid="home-sync-error-icon"]').should('be.visible');
        cy.visit('/home', {
            onBeforeLoad(win) {
                win.localStorage.removeItem('app_counters');
            },
        });
        cy.get('[data-testid="home-sync-error-icon"]').should('be.visible');
        cy.then(() => {
            cy.get(`[data-testid="counter-${counterId}-count"]`).should('have.text', '1');
        });
        cy.window().should((win) => {
            const queue = JSON.parse(win.localStorage.getItem('app_sync_queue') || '[]');
            expect(queue.map((item: { type: string }) => item.type)).to.deep.equal(['CREATE', 'INCREMENT']);
        });

        cy.then(() => {
            cy.get(`[data-testid="counter-${counterId}-sync-error"]`).should('be.visible');
            cy.viewport(390, 844);
            cy.get(`[data-testid="counter-${counterId}-sync-error"]`).click();
        });
        cy.get('[data-testid="counter-title"]').clear().type('Water corrected');
        cy.then(() => {
            available = true;
        });
        cy.get('[data-testid="counter-form-submit"]').click();
        cy.wait('@created').its('response.statusCode').should('eq', 201);
        cy.get('[data-testid="home-sync-synced-icon"]').should('be.visible');
        cy.request('GET', '/counters').then(({ body }) => {
            expect(body.data.counters).to.have.length(1);
            expect(body.data.counters[0]).to.include({
                id: counterId,
                count: 1,
                metric: '16oz bottle',
                title: 'Water corrected',
            });
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

    it('receives counter creation, edits, and deletion from another session without reloading', () => {
        cy.request('POST', '/counters', { title: 'From phone', metric: 'bottle', increment: 0.5, count: 2 }).then(
            ({ body }) => {
                const counter: ClientCounter = body.data.counter;
                cy.get(`[data-testid="counter-${counter.id}-count"]`).should('have.text', '2');
                cy.get(`[data-testid="counter-${counter.id}-metric"]`).should('have.text', 'bottle');
                cy.request('PUT', `/counters/update/${counter.id}`, { title: 'Renamed on phone', metric: 'cup' });
                cy.get(`[data-testid="counter-${counter.id}-title"]`).should('have.text', 'Renamed on phone');
                cy.get(`[data-testid="counter-${counter.id}-metric"]`).should('have.text', 'cup');
                cy.request('DELETE', `/counters/${counter.id}`);
                cy.get(`[data-testid="counter-${counter.id}-count"]`).should('not.exist');
            },
        );
    });
});
