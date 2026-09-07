import { User, Counter, CounterShare } from './generated';
import { HexColor } from './index';

export type ClientUser = Omit<User, 'password' | 'createdAt' | 'updatedAt' | 'emailVerifiedAt' | 'sessionVersion'> & {
    emailVerified: boolean;
};

export type ClientCounter = Omit<Counter, 'createdAt' | 'updatedAt' | 'color'> & {
    color: HexColor | null;
    shares?: CounterShare[];
};
