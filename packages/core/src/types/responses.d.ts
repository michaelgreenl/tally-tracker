import { ClientUser } from './models';
import { ClientCounter } from './models';

export type ApiResponse<T> =
    | {
          success: true;
          message?: string;
          data?: T;
      }
    | {
          success: false;
          message: string;
          data?: never;
      };

export type AuthResponse = ApiResponse<{
    user?: ClientUser;
    accessToken?: string;
    refreshToken?: string;
}>;

export type GoogleAuthResponse = AuthResponse & { code?: 'GOOGLE_LINK_REQUIRED' };

export type SignInMethods = { google: boolean; apple: boolean };

export type CounterResponse = ApiResponse<{
    counter?: ClientCounter;
    counters?: Array<ClientCounter>;
}>;
