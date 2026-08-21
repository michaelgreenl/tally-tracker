import { OK, CREATED } from '../support/status-codes';
import { buildCounter } from '../fixtures/counter.fixture';
import { buildClientUser } from '../fixtures/user.fixture';

type CounterPostInterception = {
    request: {
        method: string;
        body: { title: string };
        headers: Record<string, string | string[]>;
    };
    response?: { statusCode: number };
};

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const authRes = (user: ReturnType<typeof buildClientUser>) => ({
    statusCode: OK,
    body: {
        success: true,
        data: {
            user,
            accessToken: 'token',
        },
    },
});

describe('Counters', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
    });

    describe('Authenticated User', () => {
        let authenticatedUserId = '';

        beforeEach(() => {
            const user = buildClientUser({ email: 'alice@example.com', tier: 'PREMIUM' });
            authenticatedUserId = user.id;

            cy.intercept('POST', '/users/login', authRes(user));
            cy.intercept('GET', '/users/check-auth', authRes(user));
            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: { success: true, data: { counters: [] } },
            }).as('getCountersInit');

            cy.login('alice@example.com', 'password123');
            cy.wait('@getCountersInit');
        });

        it('should display existing counters', () => {
            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: {
                    success: true,
                    data: {
                        counters: [
                            buildCounter({ title: 'Push Ups', userId: authenticatedUserId }),
                            buildCounter({ title: 'Water Glasses', userId: authenticatedUserId }),
                        ],
                    },
                },
            }).as('getCounters');

            cy.visit('/home');
            cy.wait('@getCounters');

            cy.contains('Push Ups').should('be.visible');
            cy.contains('Water Glasses').should('be.visible');
        });

        it('should create a new counter', () => {
            cy.intercept('POST', '/counters', {
                statusCode: CREATED,
                body: {
                    success: true,
                    data: { counter: buildCounter({ title: 'New Counter', userId: authenticatedUserId }) },
                },
            }).as('createCounter');

            cy.get('[data-testid="add-counter-button"]').click();
            cy.get('[data-testid="home-counter-form"]').should('be.visible');

            cy.get('form input[type="text"]').type('New Counter');
            cy.get('[data-testid="counter-form-submit"]').click();

            cy.wait('@createCounter').then(({ request, response }) => {
                expect(request.method).to.eq('POST');
                expect(request.body).to.deep.equal({
                    id: request.body.id,
                    title: 'New Counter',
                    color: '#000000',
                    count: 0,
                    type: 'PERSONAL',
                    inviteCode: null,
                });
                expect(request.body.id).to.match(UUID_V4_PATTERN);
                expect(request.headers['x-idempotency-key']).to.be.a('string').and.not.be.empty;
                expect(response?.statusCode).to.eq(CREATED);
            });

            cy.contains('New Counter').should('be.visible');
        });

        it('should increment a counter optimistically', () => {
            const counter = buildCounter({ count: 5, userId: authenticatedUserId });

            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: {
                    success: true,
                    data: { counters: [counter] },
                },
            }).as('getCounters');

            cy.intercept('PUT', `/counters/${counter.id}/count`, {
                statusCode: OK,
                body: {
                    success: true,
                    data: {
                        counter: { ...counter, count: 6 },
                    },
                },
            }).as('setIncrementedCount');

            cy.visit('/home');
            cy.wait('@getCounters');

            cy.contains('.counter-wrapper', counter.title).as('counterCard');
            cy.get('@counterCard').contains('h3', '5').should('be.visible');
            cy.get('@counterCard').contains('ion-button', '+1').click();

            cy.wait('@setIncrementedCount').then(({ request, response }) => {
                expect(request.method).to.eq('PUT');
                expect(request.body).to.deep.equal({ count: 6 });
                expect(request.headers['x-idempotency-key']).to.be.a('string').and.not.be.empty;
                expect(response?.statusCode).to.eq(OK);
            });

            cy.get('@counterCard').contains('h3', '6').should('be.visible');
        });

        it('should decrement a counter optimistically', () => {
            const counter = buildCounter({ count: 5, userId: authenticatedUserId });

            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: {
                    success: true,
                    data: { counters: [counter] },
                },
            }).as('getCounters');

            cy.intercept('PUT', `/counters/${counter.id}/count`, {
                statusCode: OK,
                body: {
                    success: true,
                    data: {
                        counter: { ...counter, count: 4 },
                    },
                },
            }).as('setDecrementedCount');

            cy.visit('/home');
            cy.wait('@getCounters');

            cy.contains('.counter-wrapper', counter.title).as('counterCard');
            cy.get('@counterCard').contains('ion-button', '-1').click();

            cy.wait('@setDecrementedCount').then(({ request, response }) => {
                expect(request.method).to.eq('PUT');
                expect(request.body).to.deep.equal({ count: 4 });
                expect(request.headers['x-idempotency-key']).to.be.a('string').and.not.be.empty;
                expect(response?.statusCode).to.eq(OK);
            });

            cy.get('@counterCard').contains('h3', '4').should('be.visible');
        });

        it('should delete a counter', () => {
            const counter = buildCounter({ title: 'Delete Me', userId: authenticatedUserId });

            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: {
                    success: true,
                    data: {
                        counters: [counter],
                    },
                },
            }).as('getCounters');

            cy.intercept('DELETE', `/counters/${counter.id}`, {
                statusCode: OK,
                body: { success: true },
            }).as('deleteCounter');

            cy.visit('/home');
            cy.wait('@getCounters');

            cy.contains('Delete Me').should('be.visible');
            cy.contains('.counter-wrapper', 'Delete Me').within(() => {
                cy.contains('ion-button', 'delete').click();
            });

            cy.wait('@deleteCounter').then(({ request, response }) => {
                expect(request.method).to.eq('DELETE');
                expect(request.headers['x-idempotency-key']).to.be.a('string').and.not.be.empty;
                expect(response?.statusCode).to.eq(OK);
                expect(response?.body).to.deep.equal({ success: true });
            });

            cy.contains('Delete Me').should('not.exist');
        });
    });

    describe('Guest User', () => {
        beforeEach(() => {
            cy.loginAsGuest();
        });

        const createGuestCounter = (title: string) => {
            cy.get('[data-testid="add-counter-button"]').click();
            cy.get('[data-testid="home-counter-form"]').should('be.visible');
            cy.get('form input[type="text"]').type(title);
            cy.get('[data-testid="counter-form-submit"]').click();
            cy.get('[data-testid="home-counter-form"]').should('not.exist');
            cy.get('[data-testid="add-counter-button"]').should('be.visible');
            cy.contains(title).should('be.visible');
        };

        it('should allow creating counters as guest', () => {
            cy.url().should('include', '/home');
            createGuestCounter('Guest Counter');
        });

        it('should persist counters locally', () => {
            cy.url().should('include', '/home');
            createGuestCounter('Persistent Counter');

            cy.reload();

            cy.contains('Persistent Counter').should('be.visible');
        });

        it('should consolidate local counters after registering with new account', () => {
            const email = `test-${crypto.randomUUID()}@example.com`;
            const password = 'password123';

            createGuestCounter('Guest Counter A');
            createGuestCounter('Guest Counter B');
            createGuestCounter('Guest Counter C');

            cy.intercept('POST', '/users', {
                statusCode: CREATED,
                body: { success: true },
            }).as('registerReq');

            cy.visit('/register');

            cy.contains('h1', 'Create Account').closest('.ion-page').as('registerPage');

            cy.get('@registerPage').within(() => {
                cy.get('input[type="email"]').should('have.length', 1).type(email);
                cy.get('input[type="password"]').should('have.length', 2);
                cy.get('input[type="password"]').first().type(password);
                cy.get('input[type="password"]').last().type(password);
                cy.contains('ion-button', 'Register').click();
            });

            cy.wait('@registerReq').its('response.statusCode').should('eq', 201);

            cy.contains('h1', 'Welcome to Tally Tracker').closest('.ion-page').as('loginPage');

            const user = buildClientUser({ email, tier: 'BASIC' });
            cy.intercept('POST', '/users/login', authRes(user)).as('loginReq');

            cy.intercept('GET', '/counters', (req) => {
                req.reply({ delay: 500, statusCode: OK, body: { success: true, data: { counters: [] } } });
            }).as('getCounters');

            cy.intercept('POST', '/counters', (req) => {
                req.reply({
                    statusCode: CREATED,
                    body: {
                        success: true,
                        data: { counter: buildCounter({ ...req.body, userId: user.id }) },
                    },
                });
            }).as('syncGuestCounter');

            cy.get('@loginPage').within(() => {
                cy.get('input[type="email"]').should('have.length', 1).type(email);
                cy.get('input[type="password"]').should('have.length', 1).type(password);
                cy.contains('ion-button', 'Login').click();
            });

            cy.wait('@loginReq').its('response.statusCode').should('eq', 200);
            cy.wait('@getCounters');

            cy.get<CounterPostInterception[]>('@syncGuestCounter.all', { timeout: 20000 })
                .should('have.length', 3)
                .should((interceptions) => {
                    interceptions.forEach(({ response }) => {
                        expect(response?.statusCode).to.eq(CREATED);
                    });
                })
                .then((interceptions) => {
                    const submittedTitles = interceptions.map(({ request, response }) => {
                        expect(request.method).to.eq('POST');
                        expect(request.headers['x-idempotency-key']).to.be.a('string').and.not.be.empty;
                        expect(response?.statusCode).to.eq(CREATED);
                        return request.body.title;
                    });

                    expect(submittedTitles).to.have.members(['Guest Counter A', 'Guest Counter B', 'Guest Counter C']);
                });

            cy.contains('Guest Counter A').should('be.visible');
            cy.contains('Guest Counter B').should('be.visible');
            cy.contains('Guest Counter C').should('be.visible');
        });

        it('should open the guest-limit modal instead of the form at the cap', () => {
            createGuestCounter('Guest Counter 1');
            createGuestCounter('Guest Counter 2');
            createGuestCounter('Guest Counter 3');

            cy.get('[data-testid="add-counter-button"]').click();

            cy.get('[data-testid="guest-limit-modal"]').should('be.visible');
            cy.get('[data-testid="home-counter-form"]').should('not.exist');
            cy.get('ion-list ion-item').should('have.length', 3);

            cy.get('[data-testid="guest-limit-modal-dismiss"]').click();

            cy.get('[data-testid="guest-limit-modal"]').should('not.exist');
            cy.get('[data-testid="add-counter-button"]').should('be.visible');
        });

        it('should return home from the upgrade placeholder without changing guest counters', () => {
            createGuestCounter('Guest Counter 1');
            createGuestCounter('Guest Counter 2');
            createGuestCounter('Guest Counter 3');

            cy.get('[data-testid="add-counter-button"]').click();

            cy.get('[data-testid="guest-limit-modal"]').should('be.visible');
            cy.get('[data-testid="home-counter-form"]').should('not.exist');

            cy.get('[data-testid="guest-limit-modal-upgrade"]').click();

            cy.location('pathname').should('eq', '/upgrade');
            cy.get('[data-testid="upgrade-placeholder-page"]').should('be.visible');
            cy.contains('This page is informational only').should('be.visible');
            cy.contains('Upgrade and billing functionality are not implemented yet').should('be.visible');

            cy.get('[data-testid="upgrade-placeholder-back"]').click();

            cy.location('pathname').should('eq', '/home');
            cy.contains('Welcome Guest!').should('be.visible');
            cy.contains('Guest Counter 1').should('be.visible');
            cy.contains('Guest Counter 2').should('be.visible');
            cy.contains('Guest Counter 3').should('be.visible');
            cy.get('ion-list ion-item').should('have.length', 3);
            cy.get('[data-testid="home-counter-form"]').should('not.exist');

            cy.get('[data-testid="add-counter-button"]').click();

            cy.get('[data-testid="guest-limit-modal"]').should('be.visible');
            cy.get('[data-testid="home-counter-form"]').should('not.exist');
        });
    });
});
