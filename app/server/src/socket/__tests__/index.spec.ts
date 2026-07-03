import { createServer } from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { io as createClient } from 'socket.io-client';

import type { AddressInfo } from 'net';
import type { Server as HttpServer } from 'http';
import type { Server as SocketServer } from 'socket.io';
import type { Socket as ClientSocket } from 'socket.io-client';

vi.stubEnv('JWT_SECRET', 'test-secret-key-for-testing');

const TEST_USER_ID = 'user-123';
const TEST_OTHER_USER_ID = 'user-456';

type ClientOptions = NonNullable<Parameters<typeof createClient>[1]>;

let httpServer: HttpServer;
let io: SocketServer;
let serverUrl: string;
let clients: ClientSocket[] = [];

const startSocketServer = async () => {
    const { default: initializeIO } = await import('../index.js');

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
    serverUrl = `http://localhost:${address.port}`;
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

const signAccessToken = async (userId: string) => {
    const { default: jwtUtil } = await import('../../util/jwt.util.js');
    return jwtUtil.sign({ id: userId });
};

const connectClient = (options: ClientOptions = {}) => {
    const client = createClient(serverUrl, {
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        ...options,
    });

    clients.push(client);
    return client;
};

const waitForConnect = (client: ClientSocket) =>
    new Promise<void>((resolve, reject) => {
        const cleanup = () => {
            client.off('connect', onConnect);
            client.off('connect_error', onConnectError);
        };

        const onConnect = () => {
            cleanup();
            resolve();
        };

        const onConnectError = (error: Error) => {
            cleanup();
            reject(error);
        };

        client.once('connect', onConnect);
        client.once('connect_error', onConnectError);
    });

const waitForConnectError = (client: ClientSocket) =>
    new Promise<Error>((resolve, reject) => {
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
    });

const waitForCounterUpdate = (client: ClientSocket) =>
    new Promise<unknown>((resolve) => {
        client.once('counter-update', resolve);
    });

const expectNoCounterUpdate = (client: ClientSocket, timeoutMs = 150) =>
    new Promise<void>((resolve, reject) => {
        const onUpdate = () => {
            clearTimeout(timeout);
            reject(new Error('Received counter-update unexpectedly'));
        };

        const timeout = setTimeout(() => {
            client.off('counter-update', onUpdate);
            resolve();
        }, timeoutMs);

        client.once('counter-update', onUpdate);
    });

const waitForServerToHandleEvent = () => new Promise<void>((resolve) => setTimeout(resolve, 25));

describe('Socket server authentication', () => {
    beforeEach(async () => {
        await startSocketServer();
    });

    afterEach(async () => {
        await closeSocketServer();
    });

    it('rejects unauthenticated clients', async () => {
        const client = connectClient();

        const error = await waitForConnectError(client);

        expect(error.message).toBe('Not authenticated');
        expect(client.connected).toBe(false);
    });

    it('joins authenticated cookie clients to their own user room', async () => {
        const token = await signAccessToken(TEST_USER_ID);
        const client = connectClient({
            extraHeaders: {
                Cookie: `access_token=${token}`,
            },
        });

        await waitForConnect(client);

        const counterUpdate = { id: 'counter-1', count: 1 };
        const receivedUpdate = waitForCounterUpdate(client);
        io.to(TEST_USER_ID).emit('counter-update', counterUpdate);

        await expect(receivedUpdate).resolves.toEqual(counterUpdate);
    });

    it('joins authenticated native clients to their own user room', async () => {
        const token = await signAccessToken(TEST_USER_ID);
        const client = connectClient({
            auth: { token },
        });

        await waitForConnect(client);

        const counterUpdate = { id: 'counter-2', count: 2 };
        const receivedUpdate = waitForCounterUpdate(client);
        io.to(TEST_USER_ID).emit('counter-update', counterUpdate);

        await expect(receivedUpdate).resolves.toEqual(counterUpdate);
    });

    it('does not let clients join another user room with join-room', async () => {
        const token = await signAccessToken(TEST_USER_ID);
        const client = connectClient({
            auth: { token },
        });

        await waitForConnect(client);

        client.emit('join-room', TEST_OTHER_USER_ID);
        await waitForServerToHandleEvent();

        expect(io.sockets.adapter.rooms.get(TEST_OTHER_USER_ID)?.has(client.id as string)).not.toBe(true);

        const noUpdate = expectNoCounterUpdate(client);
        io.to(TEST_OTHER_USER_ID).emit('counter-update', { id: 'private-counter', count: 10 });

        await expect(noUpdate).resolves.toBeUndefined();
    });
});
