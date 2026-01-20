import { User, Counter } from './generated';
import { HexColor } from './index';

export type ClientUser = Omit<User, 'password' | 'createdAt' | 'updatedAt'>;

export type ClientCounter = Omit<Counter, 'createdAt' | 'updatedAt' | 'color'> & {
    color: HexColor | null;
};
