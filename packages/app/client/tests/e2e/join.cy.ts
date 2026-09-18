/// <reference types="cypress" />

describe('Shared counter invitations', () => {
    for (const flow of ['login', 'register', 'reset', 'session restore', 'email verification']) {
        it(`resumes the original invite after ${flow}`, () => {
            const inviteCode = crypto.randomUUID();
            const counter = {
                id: crypto.randomUUID(),
                userId: 'owner',
                title: 'Invited counter',
                count: 7,
                color: '#000000',
                type: 'SHARED',
                inviteCode,
            };
            const user = { id: 'recipient', email: 'recipient@example.com', tier: 'BASIC', emailVerified: true };
            cy.clearCookies();
            cy.clearLocalStorage();
            cy.intercept('GET', '**/counters', {
                delay: 500,
                body: { success: true, data: { counters: [] } },
            }).as('loadCounters');
            cy.intercept('POST', '**/counters/join', {
                body: { success: true, data: { counter } },
            }).as('join');
            if (flow === 'session restore') {
                cy.intercept('GET', '**/users/check-auth', { body: { success: true, data: { user } } });
                cy.visit(`/join?code=${inviteCode}`, {
                    onBeforeLoad(win) {
                        win.localStorage.setItem('auth_user_profile', JSON.stringify(user));
                    },
                });
            } else {
                cy.visit(`/join?code=${inviteCode}`);
                cy.location('pathname').should('eq', '/login');

                if (flow === 'register') {
                    cy.intercept('POST', '**/users', { statusCode: 201, body: { success: true } });
                    cy.intercept('POST', '**/users/verify-email', { body: { success: true } });
                    cy.get('[data-testid="auth-switch-mode"]').click();
                    cy.location('pathname').should('eq', '/register');
                    cy.get('[data-testid="auth-email"]').filter(':visible').type('recipient@example.com');
                    cy.get('[data-testid="auth-password"]').filter(':visible').type('New-password123');
                    cy.get('[data-testid="auth-confirm-password"]').type('New-password123');
                    cy.get('[data-testid="auth-submit"]').filter(':visible').click();
                    cy.get('[data-testid="email-auth-code"]').type('123456');
                    cy.get('[data-testid="email-auth-submit"]').click();
                    cy.get('[data-testid="email-auth-login"]').click();
                } else if (flow === 'reset') {
                    cy.intercept('POST', '**/users/reset-password/request', { body: { success: true } });
                    cy.intercept('POST', '**/users/reset-password/verify', { body: { success: true } });
                    cy.intercept('POST', '**/users/reset-password', { body: { success: true } });
                    cy.get('[data-testid="auth-forgot-password"]').click();
                    cy.get('[data-testid="email-auth-email"]').type('recipient@example.com');
                    cy.get('[data-testid="email-auth-request"]').click();
                    cy.get('[data-testid="email-auth-code"]').type('123456');
                    cy.get('[data-testid="email-auth-submit"]').click();
                    cy.get('[data-testid="email-auth-password"]').type('New-password123');
                    cy.get('[data-testid="email-auth-confirm-password"]').type('New-password123');
                    cy.get('[data-testid="email-auth-submit"]').click();
                    cy.get('[data-testid="email-auth-login"]').click();
                }

                cy.location('pathname').should('eq', '/login');
                cy.reload();
                cy.intercept('POST', '**/users/login', {
                    statusCode: 401,
                    body: { success: false, message: 'Incorrect password.' },
                }).as('failedLogin');
                if (flow === 'login' || flow === 'email verification')
                    cy.get('[data-testid="auth-email"]').type('recipient@example.com');
                else cy.get('[data-testid="auth-email"]').should('have.value', 'recipient@example.com');
                cy.get('[data-testid="auth-password"]').type('WrongPassword123');
                cy.get('[data-testid="auth-submit"]').click();
                cy.wait('@failedLogin');
                cy.get('[data-testid="auth-error"]').should('be.visible');
                cy.get('@join.all').should('have.length', 0);

                cy.intercept('POST', '**/users/login', {
                    body: { success: true, data: { user: { ...user, emailVerified: flow !== 'email verification' } } },
                });
                cy.get('[data-testid="auth-password"]').clear().type('New-password123');
                cy.get('[data-testid="auth-submit"]').click();
                if (flow === 'email verification') {
                    cy.intercept('POST', '**/users/verify-email/request', { body: { success: true } }).as(
                        'requestCode',
                    );
                    cy.intercept('POST', '**/users/verify-email', { body: { success: true } }).as('verifyEmail');
                    cy.intercept('GET', '**/users/check-auth', { body: { success: true, data: { user } } });
                    cy.location('pathname').should('eq', '/verify-email');
                    cy.get('[data-testid="email-auth-email"]')
                        .should('have.value', user.email)
                        .and('have.attr', 'readonly');
                    cy.get('@join.all').should('have.length', 0);
                    cy.get('[data-testid="email-auth-request"]').click();
                    cy.wait('@requestCode').its('request.body').should('deep.equal', { email: user.email });
                    cy.get('[data-testid="email-auth-code"]').type('123456');
                    cy.get('@verifyEmail.all').should('have.length', 0);
                    cy.get('[data-testid="email-auth-submit"]').click();
                    cy.wait('@verifyEmail');
                    cy.get('[data-testid="email-auth-login"]').click();
                }
            }
            cy.wait('@join').its('request.body').should('deep.equal', { inviteCode });
            cy.wait('@loadCounters');
            cy.location('pathname').should('eq', '/home');
            cy.get(`[data-testid="counter-${counter.id}-count"]`).should('have.text', '7');
            cy.get('@join.all').should('have.length', 1);
        });
    }
});
