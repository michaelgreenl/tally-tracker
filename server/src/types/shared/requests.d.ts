import { ClientUser } from './models';
import { HexColor } from './index';
import { UserTier, CounterType } from './generated/index.ts';

// ***** Express *****
declare global {
    namespace Express {
        interface Request {
            user?: ClientUser;
        }
    }
}

// ***** User Requests *****
export interface AuthRequest {
    email?: string;
    phone?: string;
    password: string;
}

export interface UpdateUserRequest {
    email?: string;
    phone?: string;
    password?: string;
    tier?: UserTier;
}

// ***** Counter Requests *****
export interface CreateCounterRequest {
    id?: string;
    title: string;
    count?: number;
    color?: HexColor;
    type?: CounterType;
}

export interface UpdateCounterRequest {
    title?: string;
    count?: number;
    color?: HexColor;
    type?: CounterType;
}

export interface IncrementCounterRequest {
    amount: number;
}
