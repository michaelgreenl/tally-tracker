import { User, Counter, CounterShare } from './generated';
import { HexColor } from './index';

export type ClientUser = Omit<
    User,
    | 'password'
    | 'googleSubject'
    | 'appleSubject'
    | 'appleRefreshToken'
    | 'appleCredentialUpdatedAt'
    | 'createdAt'
    | 'updatedAt'
    | 'emailVerifiedAt'
    | 'sessionVersion'
    | 'premiumExpiresAt'
    | 'billingCheckedAt'
    | 'billingSandbox'
> & {
    emailVerified: boolean;
};

export type ClientCounter = Omit<Counter, 'createdAt' | 'updatedAt' | 'color' | 'count' | 'increment'> & {
    count: number;
    increment: number;
    color: HexColor | null;
    shares?: CounterShare[];
};
