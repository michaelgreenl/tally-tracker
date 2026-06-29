import { ClientUser } from './models';
import { HexColor } from './index';
import { UserTier, CounterTypeType as CounterType, ShareStatusType } from './generated/index.ts';

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
    email: string;
    password: string;
    rememberMe?: boolean;
}

export interface RefreshRequest {
    refreshToken?: string;
}

export interface UpdateUserRequest {
    email: string;
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
    inviteCode?: string;
}

export interface UpdateCounterRequest {
    title?: string;
    color?: HexColor;
    type?: CounterType;
}

export interface SetCounterCountRequest {
    count: number;
}

export interface IncrementCounterRequest {
    amount: number;
}

export interface JoinCounterRequest {
    inviteCode: string;
}

export interface UpdateShareRequest {
    counterId: string;
    status?: ShareStatusType;
}
