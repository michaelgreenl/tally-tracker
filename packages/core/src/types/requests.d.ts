import { HexColor } from './index';
import { ShareStatusType } from './generated/index.ts';

export interface AccessTokenPayload {
    id: string;
    email: string;
    sessionVersion: number;
}

// ***** Express *****
declare global {
    namespace Express {
        interface Request {
            user?: AccessTokenPayload & { emailVerifiedAt: Date | null };
        }
    }
}

// ***** User Requests *****
export interface AuthRequest {
    email: string;
    password: string;
    rememberMe?: boolean;
}

export interface GoogleLoginRequest {
    idToken: string;
    password?: string;
    rememberMe?: boolean;
}

export interface RefreshRequest {
    refreshToken?: string;
}

export interface EmailAddressRequest {
    email: string;
}

export interface EmailOtpRequest extends EmailAddressRequest {
    code: string;
}

export interface PasswordResetRequest extends EmailOtpRequest {
    password: string;
}

// ***** Counter Requests *****
export interface CreateCounterRequest {
    id?: string;
    title: string;
    count?: number;
    color?: HexColor;
    metric?: string | null;
    increment?: number;
}

export interface UpdateCounterRequest {
    title?: string;
    color?: HexColor;
    metric?: string | null;
    increment?: number;
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
