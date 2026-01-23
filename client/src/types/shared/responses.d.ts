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

export type AuthResponse = ApiResponse<{ user: ClientUser; token?: string }>;

export type CounterResponse = ApiResponse<{ counter?: ClientCounter; counters?: Array<ClientCounter> }>;
