/**
 * Each user joins a room keyed by their own userId. The server targets specific
 * participants when broadcasting, rather than using counter-scoped rooms.
 * This avoids room management complexity and prevents data leaking to unauthorized users.
 */

import { Server } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import { socketCorsOpts } from '../config/cors.config.js';
import jwtUtil from '../util/jwt.util.js';

import { Server as HttpServer } from 'http';
import type { Socket } from 'socket.io';

const ACCESS_TOKEN_COOKIE = 'access_token';
const AUTH_ERROR = 'Not authenticated';
const INVALID_TOKEN_ERROR = 'Invalid token';

type SocketAuthPayload = {
    token?: unknown;
};

type VerifiedToken = {
    id?: unknown;
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
    const cookieToken = getCookieToken(getHeaderValue(socket.handshake.headers.cookie));
    if (cookieToken) return cookieToken;

    const bearerToken = getBearerToken(getHeaderValue(socket.handshake.headers.authorization));
    if (bearerToken) return bearerToken;

    const auth = socket.handshake.auth as SocketAuthPayload | undefined;
    return typeof auth?.token === 'string' && auth.token ? auth.token : undefined;
};

const getVerifiedUserId = (token: string) => {
    const decoded = jwtUtil.verify(token) as VerifiedToken;

    if (typeof decoded.id !== 'string' || !decoded.id) {
        throw new Error(INVALID_TOKEN_ERROR);
    }

    return decoded.id;
};

const authenticateSocket = (socket: Socket, next: (error?: Error) => void) => {
    const token = getAuthToken(socket);

    if (!token) {
        return next(new Error(AUTH_ERROR));
    }

    try {
        socket.data.userId = getVerifiedUserId(token);
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
        console.log('Client connected:', socket.id);

        const userId = socket.data.userId as string;
        console.log(`Socket ${socket.id} joining room ${userId}`);
        socket.join(userId);

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
};

export default initializeIO;
