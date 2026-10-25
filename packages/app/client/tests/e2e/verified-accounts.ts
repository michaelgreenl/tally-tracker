/// <reference types="cypress" />

// The server keeps only a digest of each emailed code, so accounts made in e2e tests stay unverified.
// Report them verified so Home's verification gate lets them in.
export function reportAccountsVerified() {
    cy.intercept({ url: '**/users/**', middleware: true }, (request) =>
        request.on('before:response', (response) => {
            if (response.body?.data?.user) response.body.data.user.emailVerified = true;
        }),
    );
}
