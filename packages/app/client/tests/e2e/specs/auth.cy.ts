import { OK, UNAUTHORIZED } from '../support/status-codes';
import { buildCounter } from '../fixtures/counter.fixture';

describe('Authentication', () => {
    beforeEach(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
    });

    describe('Login', () => {
        it('should login and redirect to home', () => {
            cy.intercept('POST', '/users/login').as('login');

            cy.login('alice@example.com', 'password123');

            cy.wait('@login').its('response.statusCode').should('eq', OK);
            cy.url().should('include', '/home');
            cy.getCookie('access_token').should('exist');
        });

        it('should login with remember me and receive refresh token', () => {
            cy.intercept('POST', '/users/login').as('login');

            cy.login('alice@example.com', 'password123', true);

            cy.wait('@login').then(({ request, response }) => {
                expect(request.body.rememberMe).to.eq(true);

                if (!response) throw new Error('Expected the login request to receive a response');

                expect(response.statusCode).to.eq(OK);
            });

            cy.getCookie('access_token').should('exist');
            cy.getCookie('refresh_token').should('exist');
        });

        it('should show error on invalid credentials', () => {
            cy.intercept('POST', '/users/login', {
                statusCode: UNAUTHORIZED,
                body: { success: false, message: 'Incorrect password.' },
            }).as('login');

            cy.visit('/login');
            cy.get('input[type="email"]').type('alice@example.com');
            cy.get('input[type="password"]').type('wrongpassword');
            cy.contains('ion-button', 'Login').click();

            cy.wait('@login');
            cy.get('.error-box').should('contain', 'Incorrect password');
            cy.url().should('include', '/login');
        });

        it('should redirect to home if already authenticated', () => {
            cy.login('alice@example.com', 'password123');
            cy.visit('/login');
            cy.url().should('include', '/home');
        });
    });

    describe('Guest Mode', () => {
        it('should allow access to home without login', () => {
            cy.loginAsGuest();
            cy.url().should('include', '/home');
            cy.contains('Welcome Guest').should('be.visible');
        });
    });

    describe('Logout', () => {
        it('should clear session and redirect to login', () => {
            cy.login('alice@example.com', 'password123');

            cy.intercept('POST', '/users/logout').as('logout');
            cy.contains('ion-button', 'Logout').click();

            cy.wait('@logout');
            cy.url().should('include', '/login');
            cy.getCookie('access_token').should('not.exist');
        });
    });

    describe('Token Refresh', () => {
        it('should refresh token and retry request on 401', () => {
            let authenticatedUserId = '';
            let recoveredCounter: ReturnType<typeof buildCounter> | undefined;

            cy.intercept('POST', '/users/login').as('login');

            cy.intercept(
                { method: 'GET', url: '/counters', times: 1 },
                {
                    statusCode: OK,
                    body: { success: true, data: { counters: [] } },
                },
            ).as('initialCounters');

            cy.intercept('POST', '/users/refresh', {
                statusCode: OK,
                body: { success: true, data: { accessToken: 'new-token' } },
            }).as('refreshToken');

            cy.login('alice@example.com', 'password123', true);
            cy.wait('@login').then(({ response }) => {
                const userId = response?.body?.data?.user?.id;
                if (typeof userId !== 'string' || !userId) {
                    throw new Error('Expected login response to identify the authenticated user');
                }

                authenticatedUserId = userId;
            });
            cy.wait('@initialCounters').its('response.statusCode').should('eq', OK);

            let refreshCounterCallCount = 0;

            cy.intercept('GET', '/counters', (req) => {
                refreshCounterCallCount++;

                if (refreshCounterCallCount === 1) {
                    req.alias = 'expiredCounters';
                    req.reply({ statusCode: UNAUTHORIZED, body: { message: 'Token expired' } });
                    return;
                }

                if (!authenticatedUserId) throw new Error('Expected authenticated user id before retrying counters');

                recoveredCounter = buildCounter({
                    title: 'Recovered Counter',
                    count: 7,
                    userId: authenticatedUserId,
                });
                req.alias = 'retriedCounters';
                req.reply({
                    statusCode: OK,
                    body: { success: true, data: { counters: [recoveredCounter] } },
                });
            });

            cy.reload();

            cy.wait('@expiredCounters').its('response.statusCode').should('eq', UNAUTHORIZED);
            cy.wait('@refreshToken');
            cy.wait('@retriedCounters').then(({ response }) => {
                if (!recoveredCounter) throw new Error('Expected the retry response counter fixture');

                expect(response?.statusCode).to.eq(OK);
                expect(response?.body).to.deep.equal({
                    success: true,
                    data: { counters: [recoveredCounter] },
                });
            });

            cy.url().should('include', '/home');
            cy.contains('.counter-wrapper', 'Recovered Counter').within(() => {
                cy.contains('h3', '7').should('be.visible');
            });
        });

        it('should logout when refresh fails', () => {
            cy.intercept('POST', '/users/login').as('login');

            cy.intercept('GET', '/counters', {
                statusCode: OK,
                body: { success: true, data: { counters: [] } },
            }).as('getCountersSuccess');

            cy.login('alice@example.com', 'password123', true);

            cy.wait('@login');
            cy.wait('@getCountersSuccess');
            cy.url().should('include', '/home');

            cy.intercept('GET', '/counters', {
                statusCode: UNAUTHORIZED,
                body: { message: 'Token expired' },
            }).as('getCounters401');

            cy.intercept('POST', '/users/refresh', {
                statusCode: UNAUTHORIZED,
                body: { message: 'Refresh token invalid' },
            }).as('refreshToken');

            cy.reload();

            cy.wait('@getCounters401');
            cy.wait('@refreshToken');

            cy.url().should('include', '/login');
        });
    });
});
