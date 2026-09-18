/**
 * Each user joins a room keyed by their own userId. The server targets specific
 * participants when broadcasting, rather than using counter-scoped rooms.
 * This avoids room management complexity and prevents data leaking to unauthorized users.
 */

import { Server } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import { socketCorsOpts } from '../config/cors.config.js';
import * as userRepository from '../db/repositories/user.repository.js';
import jwtUtil from '../util/jwt.util.js';

import { Server as HttpServer } from 'http';
import type { Socket } from 'socket.io';

const ACCESS_TOKEN_COOKIE = 'access_token';
const AUTH_ERROR = 'Not authenticated';
const INVALID_TOKEN_ERROR = 'Invalid token';

type SocketAuthPayload = {
    token?: unknown;
    userId?: unknown;
};

type VerifiedToken = {
    id?: unknown;
    sessionVersion?: unknown;
    exp?: unknown;
};

const getHeaderValue = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) return value[0];

    return value;
};

const getCookieToken = (cookieHeader: string | undefined) => {
    if (!cookieHeader) return undefined;

    const token = parseCookie(cookieHeader)[ACCESS_TOKEN_COOKIE];
    return token || undefined;
};

const getBearerToken = (authorizationHeader: string | undefined) => {
    if (!authorizationHeader?.startsWith('Bearer ')) return undefined;

    const token = authorizationHeader.slice('Bearer '.length).trim();
    return token || undefined;
};

const getAuthToken = (socket: Socket) => {
    const auth = socket.handshake.auth as SocketAuthPayload | undefined;
    if (typeof auth?.token === 'string' && auth.token) return auth.token;
    const bearerToken = getBearerToken(getHeaderValue(socket.handshake.headers.authorization));
    if (bearerToken) return bearerToken;
    return getCookieToken(getHeaderValue(socket.handshake.headers.cookie));
};

const getVerifiedUserId = async (token: string) => {
    const decoded = jwtUtil.verify(token) as VerifiedToken;

    if (
        typeof decoded.id !== 'string' ||
        !decoded.id ||
        typeof decoded.sessionVersion !== 'number' ||
        typeof decoded.exp !== 'number'
    ) {
        throw new Error(INVALID_TOKEN_ERROR);
    }

    const user = await userRepository.getUserAuthById(decoded.id);
    if (!user || user.sessionVersion !== decoded.sessionVersion) throw new Error(INVALID_TOKEN_ERROR);

    return { userId: decoded.id, sessionVersion: decoded.sessionVersion, expiresAt: decoded.exp * 1000 };
};

const authenticateSocket = async (socket: Socket, next: (error?: Error) => void) => {
    const token = getAuthToken(socket);

    if (!token) {
        return next(new Error(AUTH_ERROR));
    }

    try {
        const verified = await getVerifiedUserId(token);
        const expectedUserId = (socket.handshake.auth as SocketAuthPayload)?.userId;
        if (expectedUserId && expectedUserId !== verified.userId) throw new Error(INVALID_TOKEN_ERROR);
        Object.assign(socket.data, verified);
        return next();
    } catch {
        return next(new Error(INVALID_TOKEN_ERROR));
    }
};

const initializeIO = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: socketCorsOpts,
    });

    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        const userId = socket.data.userId as string;
        // Room admission and revocation use the same lock; a late handshake cannot rejoin after logout.
        void userRepository
            .withLockedUser(userId, async (user) => {
                if (
                    !socket.connected ||
                    !user ||
                    user.sessionVersion !== socket.data.sessionVersion ||
                    socket.data.expiresAt <= Date.now()
                ) {
                    socket.disconnect(true);
                    return;
                }
                await socket.join(userId);
                socket.emit('session-ready');
                const expiry = setTimeout(() => socket.disconnect(true), socket.data.expiresAt - Date.now());
                expiry.unref();
                socket.once('disconnect', () => clearTimeout(expiry));
            })
            .catch(() => socket.disconnect(true));
    });

    return io;
};

export default initializeIO;
