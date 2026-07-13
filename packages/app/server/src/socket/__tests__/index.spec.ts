import { createServer } from 'http';
import jsonwebtoken from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as createClient } from 'socket.io-client';

import initializeIO from '../index.js';

import type { AddressInfo } from 'net';
import type { Server as HttpServer } from 'http';
import type { Server as SocketServer, Socket as ServerSocket } from 'socket.io';
import type { Socket as ClientSocket } from 'socket.io-client';

const AUDIENCE = 'reaction-client';
const ISSUER = 'reaction-api';
const TEST_JWT_SECRET = 'vitest-only-jwt-secret';
const TEST_OTHER_USER_ID = 'user-456';
const TEST_USER_ID = 'user-123';
const WRONG_JWT_SECRET = 'wrong-vitest-jwt-secret';

type ClientOptions = NonNullable<Parameters<typeof createClient>[1]>;

type ConnectedClient = {
    client: ClientSocket;
    serverSocket: ServerSocket;
};

let httpServer: HttpServer;
let io: SocketServer;
let serverUrl: string;
let clients: ClientSocket[] = [];

const startSocketServer = async () => {
    httpServer = createServer();
    io = initializeIO(httpServer);

    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
            httpServer.off('listening', onListening);
            reject(error);
        };

        const onListening = () => {
            httpServer.off('error', onError);
            resolve();
        };

        httpServer.once('error', onError);
        httpServer.once('listening', onListening);
        httpServer.listen(0, '127.0.0.1');
    });

    const address = httpServer.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${address.port}`;
};

const closeSocketServer = async () => {
    clients.forEach((client) => client.disconnect());
    clients = [];

    await new Promise<void>((resolve) => {
        io.close(() => resolve());
    });

    if (!httpServer.listening) return;

    await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
};

const signAccessToken = (payload: Record<string, unknown>, secret = TEST_JWT_SECRET) =>
    jsonwebtoken.sign(payload, secret, {
        audience: AUDIENCE,
        expiresIn: '45m',
        issuer: ISSUER,
    });

const createDisconnectedClient = (options: ClientOptions = {}) => {
    const client = createClient(serverUrl, {
        ...options,
        autoConnect: false,
        forceNew: true,
        reconnection: false,
        transports: ['websocket'],
    });

    clients.push(client);
    return client;
};

const connectSuccessfully = (options: ClientOptions = {}) => {
    const client = createDisconnectedClient(options);

    return new Promise<ConnectedClient>((resolve, reject) => {
        let clientConnected = false;
        let serverSocket: ServerSocket | undefined;

        const cleanup = () => {
            client.off('connect', onClientConnect);
            client.off('connect_error', onClientConnectError);
            io.off('connection', onServerConnection);
        };

        const resolveWhenConnected = () => {
            if (!clientConnected || !serverSocket) return;

            const connectedServerSocket = serverSocket;
            cleanup();
            resolve({ client, serverSocket: connectedServerSocket });
        };

        const onClientConnect = () => {
            clientConnected = true;
            resolveWhenConnected();
        };

        const onClientConnectError = (error: Error) => {
            cleanup();
            reject(error);
        };

        const onServerConnection = (socket: ServerSocket) => {
            serverSocket = socket;
            resolveWhenConnected();
        };

        client.once('connect', onClientConnect);
        client.once('connect_error', onClientConnectError);
        io.once('connection', onServerConnection);
        client.connect();
    });
};

const connectExpectingError = (options: ClientOptions = {}) => {
    const client = createDisconnectedClient(options);

    return new Promise<Error>((resolve, reject) => {
        const cleanup = () => {
            client.off('connect', onConnect);
            client.off('connect_error', onConnectError);
        };

        const onConnect = () => {
            cleanup();
            reject(new Error('Client connected unexpectedly'));
        };

        const onConnectError = (error: Error) => {
            cleanup();
            resolve(error);
        };

        client.once('connect', onConnect);
        client.once('connect_error', onConnectError);
        client.connect();
    });
};

describe('Socket server authentication', () => {
    beforeEach(async () => {
        await startSocketServer();
    });

    afterEach(async () => {
        await closeSocketServer();
    });

    it('rejects unauthenticated clients', async () => {
        const error = await connectExpectingError();

        expect(error.message).toBe('Not authenticated');
    });

    it('keeps authenticated cookie and native clients in their own user rooms', async () => {
        const cookieToken = signAccessToken({ id: TEST_USER_ID });
        const nativeToken = signAccessToken({ id: TEST_OTHER_USER_ID });
        const cookieConnection = await connectSuccessfully({
            extraHeaders: { Cookie: `access_token=${cookieToken}` },
        });
        const nativeConnection = await connectSuccessfully({
            auth: { token: nativeToken },
        });

        expect(io.sockets.adapter.rooms.get(TEST_USER_ID)).toEqual(new Set([cookieConnection.serverSocket.id]));
        expect(io.sockets.adapter.rooms.get(TEST_OTHER_USER_ID)).toEqual(new Set([nativeConnection.serverSocket.id]));
    });

    it('does not let an authenticated client request another user room', async () => {
        const token = signAccessToken({ id: TEST_USER_ID });
        const { client, serverSocket } = await connectSuccessfully({ auth: { token } });
        const joinRoomReceived = new Promise<string>((resolve) => {
            serverSocket.once('join-room', (roomId: string) => resolve(roomId));
        });

        client.emit('join-room', TEST_OTHER_USER_ID);
        await expect(joinRoomReceived).resolves.toBe(TEST_OTHER_USER_ID);

        expect(serverSocket.rooms).toEqual(new Set([serverSocket.id, TEST_USER_ID]));
        expect(io.sockets.adapter.rooms.get(TEST_OTHER_USER_ID)?.has(serverSocket.id) ?? false).toBe(false);
    });

    it('accepts a Bearer authorization header', async () => {
        const token = signAccessToken({ id: TEST_USER_ID });
        const connection = await connectSuccessfully({
            extraHeaders: { Authorization: `Bearer ${token}` },
        });

        expect(io.sockets.adapter.rooms.get(TEST_USER_ID)).toEqual(new Set([connection.serverSocket.id]));
    });

    it('rejects a token with a bad signature', async () => {
        const token = signAccessToken({ id: TEST_USER_ID }, WRONG_JWT_SECRET);
        const error = await connectExpectingError({ auth: { token } });

        expect(error.message).toBe('Invalid token');
    });

    it.each([
        { case: 'missing', payload: {} },
        { case: 'non-string', payload: { id: 123 } },
    ])('rejects a token with a $case user id', async ({ payload }) => {
        const token = signAccessToken(payload);
        const error = await connectExpectingError({ auth: { token } });

        expect(error.message).toBe('Invalid token');
    });
});
