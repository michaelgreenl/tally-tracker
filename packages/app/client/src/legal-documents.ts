export const legalDocuments = {
    privacy: {
        title: 'Privacy Policy',
        updated: 'July 8, 2026',
        introduction:
            'Tally Tracker is a cross-platform counter app. This policy explains the information Tally Tracker handles when you use the app.',
        sections: [
            {
                title: 'Information the app handles',
                paragraphs: [
                    'Account information, such as the email address used to create or sign in to an account.',
                    'Authentication records, such as password hashes, access tokens, and refresh tokens.',
                    'Counter data, such as counter titles, counts, colors, invite codes, and sharing relationships.',
                    'Local guest data stored on your device when you use the app without signing in.',
                    'Diagnostic information needed to operate, secure, and troubleshoot the service, such as app version, device or browser details, operating system, error stack traces, request path, and event timestamps.',
                ],
            },
            {
                title: 'How information is used',
                paragraphs: [
                    'Information is used to provide account access, synchronize counters across devices, support shared counters, preserve offline changes, secure sessions, and maintain the service.',
                ],
            },
            {
                title: 'Sharing',
                paragraphs: [
                    'Tally Tracker does not sell personal information. Information may be processed by infrastructure and service providers that help operate features you use, such as hosting, database, authentication, app-store, payment, or diagnostics services.',
                    'Diagnostics are used for crash and error reporting. Tally Tracker does not intentionally send passwords, authentication tokens, or counter contents in diagnostic events.',
                ],
            },
            {
                title: 'Retention and deletion',
                paragraphs: [
                    'Account data is kept while your account is active or as needed to operate and secure the service. You can request account deletion from the Delete Account page. Guest data stored locally on your device can be removed by deleting the app or clearing app data.',
                ],
            },
            {
                title: 'Security',
                paragraphs: [
                    'Tally Tracker uses technical safeguards such as hashed passwords, authenticated API requests, and token rotation. No method of storage or transmission is perfectly secure.',
                ],
            },
            {
                title: 'Children',
                paragraphs: [
                    'Tally Tracker is not directed to children under 13. If you believe a child provided personal information, request deletion using the account deletion page.',
                ],
            },
            {
                title: 'Contact',
                paragraphs: ['For privacy questions, use the Support page.'],
            },
        ],
    },
    terms: {
        title: 'Terms of Service',
        updated: 'July 6, 2026',
        introduction:
            'These terms govern use of Tally Tracker, a counter and shared-counter app. By using Tally Tracker, you agree to these terms.',
        sections: [
            {
                title: 'Use of the app',
                paragraphs: [
                    'You may use Tally Tracker to create, manage, synchronize, and share counters. You are responsible for the information you enter and for keeping your account credentials secure.',
                ],
            },
            {
                title: 'Accounts',
                paragraphs: [
                    'Some features require an account. You agree to provide accurate account information and to notify the developer if you believe your account has been accessed without permission.',
                ],
            },
            {
                title: 'Shared counters',
                paragraphs: [
                    'If you create or join a shared counter, counter information may be visible to other users who have access to that shared counter.',
                ],
            },
            {
                title: 'Paid features',
                paragraphs: [
                    'Some features may require a purchase or subscription. Purchases and subscriptions are processed by Apple, Google, or another payment provider. Cancellation and refund rights may depend on the store or payment provider used for the purchase.',
                ],
            },
            {
                title: 'Acceptable use',
                paragraphs: [
                    'Do not misuse the app, interfere with service operation, attempt unauthorized access, or use the app in a way that violates applicable law.',
                ],
            },
            {
                title: 'Availability',
                paragraphs: [
                    'The app may change, pause, or stop operating. Tally Tracker is provided without warranties to the fullest extent allowed by law.',
                ],
            },
            {
                title: 'Limitation of liability',
                paragraphs: [
                    'To the fullest extent allowed by law, the developer is not liable for indirect, incidental, special, or consequential damages related to use of Tally Tracker.',
                ],
            },
            {
                title: 'Contact',
                paragraphs: ['For questions about these terms, use the Support page.'],
            },
        ],
    },
    support: {
        title: 'Support',
        updated: 'July 7, 2026',
        introduction:
            'Use this page for Tally Tracker support information. A direct support contact should be listed here before public store submission.',
        sections: [
            {
                title: 'Account help',
                paragraphs: [
                    'Include the email address associated with your Tally Tracker account when you need help with sign-in, account access, or account deletion.',
                ],
            },
            {
                title: 'Counter help',
                paragraphs: [
                    'Include the device platform, whether you were online or offline, and the counter action you were trying to complete.',
                ],
            },
        ],
    },
    'delete-account': {
        title: 'Delete Account',
        updated: 'July 6, 2026',
        introduction:
            'You can delete your Tally Tracker account and associated account data from the app, or request deletion if you cannot access the app. Deletion removes account access and server-side data linked to the account, including saved counters, sharing relationships, and active sessions.',
        sections: [
            {
                title: 'Delete in the app',
                paragraphs: [
                    'Sign in to Tally Tracker, open Settings, choose Delete Account, and confirm the deletion request. You may need an active internet connection so the app can remove server-side account data.',
                ],
            },
            {
                title: 'If you cannot access the app',
                paragraphs: [
                    'Use the Support page and include the email address associated with your Tally Tracker account.',
                ],
            },
            {
                title: 'What deletion removes',
                paragraphs: [
                    'Account deletion removes account access, saved counters, counter sharing relationships, invite data, and active sign-in sessions associated with the account.',
                ],
            },
            {
                title: 'What may remain',
                paragraphs: [
                    'Some operational records may be retained for a limited time when needed for security, fraud prevention, legal compliance, or debugging. Guest counters stored only on your device are removed by deleting the app or clearing app data.',
                ],
            },
        ],
    },
} as const;

export type LegalDocumentKey = keyof typeof legalDocuments;
export const legalDocumentKeys = Object.keys(legalDocuments) as LegalDocumentKey[];

export function isLegalDocumentKey(value: string): value is LegalDocumentKey {
    return legalDocumentKeys.includes(value as LegalDocumentKey);
}
