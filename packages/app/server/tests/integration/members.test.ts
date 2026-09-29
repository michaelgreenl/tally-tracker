import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import type { CounterMember } from '@tally/core';
import type { Express } from 'express';
import type { Server } from 'socket.io';
import { io as createSocket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

let app: Express;
let prisma: PrismaClient;
let io: Server;
let socketUrl: string;

beforeAll(async () => {
    const [{ default: loadedApp }, { default: loadedPrisma }, { default: initializeIO }] = await Promise.all([
        import('../../src/app.js'),
        import('../../src/db/prisma.js'),
        import('../../src/socket/index.js'),
    ]);
    app = loadedApp;
    prisma = loadedPrisma;
    const server = createServer(app);
    io = initializeIO(server);
    app.set('io', io);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    socketUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()));
});

async function account() {
    const credentials = { email: `member-${randomUUID()}@example.com`, password: 'Member-password1' };
    await request(app).post('/users').send(credentials).expect(201);
    const login = await request(app).post('/users/login').send(credentials).expect(200);
    return {
        id: login.body.data.user.id as string,
        authorization: `Bearer ${login.body.data.accessToken}`,
        credentials,
    };
}

it('claims a case-insensitive username once under concurrent requests and returns it on later sign-ins', async () => {
    const accounts = await Promise.all([account(), account()]);
    const results = await Promise.all(
        accounts.map((user, index) =>
            request(app)
                .post('/users/username')
                .set('Authorization', user.authorization)
                .send({ username: index ? 'aLeX_1' : 'Alex_1' }),
        ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const winner = accounts[results.findIndex((result) => result.status === 200)];
    const username = results.find((result) => result.status === 200)!.body.data.user.username;
    for (const response of [
        await request(app).post('/users/login').send(winner.credentials).expect(200),
        await request(app).get('/users/check-auth').set('Authorization', winner.authorization).expect(200),
    ]) {
        expect(response.body.data.user.username).toBe(username);
        expect(response.body.data.user).not.toHaveProperty('usernameKey');
    }
    // Another device completing setup must not overwrite the first device's choice.
    const retry = await request(app)
        .post('/users/username')
        .set('Authorization', winner.authorization)
        .send({ username: 'Other_name' })
        .expect(200);
    expect(retry.body.data.user.username).toBe(username);
});

it('enforces the username boundary without imposing a short length limit', async () => {
    const user = await account();
    const claim = (username: string) =>
        request(app).post('/users/username').set('Authorization', user.authorization).send({ username });
    for (const username of ['ab', 'abc def', 'abc!', 'abc\nxyz']) await claim(username).expect(422);
    expect(
        (await request(app).get('/users/check-auth').set('Authorization', user.authorization)).body.data.user.username,
    ).toBeNull();
    const username = `abc${'def'.repeat(2000)}`;
    expect((await claim(username).expect(200)).body.data.user.username).toBe(username);
    const other = await account();
    const minimum = await request(app)
        .post('/users/username')
        .set('Authorization', other.authorization)
        .send({ username: 'abc' })
        .expect(200);
    expect(minimum.body.data.user.username).toBe('abc');
});

it('exposes only accepted members and their latest action on this counter, without replaying activity', async () => {
    const [owner, member, outsider] = await Promise.all([account(), account(), account()]);
    for (const [user, username] of [
        [owner, 'Owner_name'],
        [member, 'Member_name'],
    ] as const) {
        await request(app)
            .post('/users/username')
            .set('Authorization', user.authorization)
            .send({ username })
            .expect(200);
    }
    const counter = await prisma.counter.create({
        data: {
            title: 'Water',
            type: 'SHARED',
            userId: owner.id,
            shares: {
                create: [
                    { userId: member.id, status: 'ACCEPTED' },
                    { userId: outsider.id, status: 'PENDING' },
                ],
            },
        },
    });
    const other = await prisma.counter.create({ data: { title: 'Private', userId: owner.id } });
    const increment = (id: string, authorization: string, amount: number, key = randomUUID()) =>
        request(app)
            .put(`/counters/increment/${id}`)
            .set('Authorization', authorization)
            .set('X-Idempotency-Key', key)
            .send({ amount })
            .expect(200);
    await increment(other.id, owner.authorization, 99);
    await increment(counter.id, owner.authorization, 1);
    const key = randomUUID();
    await increment(counter.id, member.authorization, -0.5, key);
    const read = async (authorization: string) =>
        request(app).get(`/counters/${counter.id}/members`).set('Authorization', authorization);
    const before = (await read(member.authorization)).body.data as CounterMember[];
    expect(before).toEqual([
        { id: owner.id, username: 'Owner_name', isOwner: true, lastAction: { amount: 1, at: expect.any(String) } },
        {
            id: member.id,
            username: 'Member_name',
            isOwner: false,
            lastAction: { amount: -0.5, at: expect.any(String) },
        },
    ]);
    await increment(counter.id, member.authorization, -0.5, key);
    expect((await read(owner.authorization)).body.data).toEqual(before);
    await increment(counter.id, member.authorization, 2);
    expect((await read(owner.authorization)).body.data[1].lastAction.amount).toBe(2);
    expect((await read(outsider.authorization)).status).toBe(404);
    await request(app)
        .put(`/counters/remove-shared/${counter.id}`)
        .set('Authorization', member.authorization)
        .expect(200);
    expect((await read(member.authorization)).status).toBe(404);
    expect((await read(owner.authorization)).body.data.map((row: CounterMember) => row.id)).toEqual([owner.id]);
    await request(app).delete(`/counters/${counter.id}`).set('Authorization', owner.authorization).expect(200);
    expect(await prisma.counterActivity.count()).toBe(0);
});

it('reports foreground presence across devices without exposing unrelated or departed members', async () => {
    const [owner, member, outsider] = await Promise.all([account(), account(), account()]);
    const counter = await prisma.counter.create({
        data: {
            title: 'Water',
            type: 'SHARED',
            userId: owner.id,
            shares: { create: { userId: member.id, status: 'ACCEPTED' } },
        },
    });
    const sockets = [owner, member, member, outsider].map((user) =>
        createSocket(socketUrl, {
            auth: { token: user.authorization.slice(7) },
            transports: ['websocket'],
            autoConnect: false,
        }),
    );
    const online = async (user = owner) =>
        (await request(app).get('/counters/presence').set('Authorization', user.authorization).expect(200)).body
            .data as string[];
    try {
        await Promise.all(
            sockets.map(async (socket) => {
                const ready = new Promise<void>((resolve, reject) => {
                    socket.once('session-ready', resolve);
                    socket.once('connect_error', reject);
                });
                socket.connect();
                await ready;
            }),
        );
        expect(await online()).toEqual([]);
        sockets.forEach((socket) => socket.emit('presence', true));
        await expect.poll(async () => (await online()).sort()).toEqual([owner.id, member.id].sort());
        sockets[1].emit('presence', false);
        await vi.waitFor(async () =>
            expect((await io.in(member.id).fetchSockets()).filter((socket) => socket.data.active)).toHaveLength(1),
        );
        expect(await online()).toContain(member.id);
        sockets[2].disconnect();
        await expect.poll(online).toEqual([owner.id]);
        sockets[1].emit('presence', true);
        await expect.poll(online).toContain(member.id);
        await request(app)
            .put(`/counters/remove-shared/${counter.id}`)
            .set('Authorization', member.authorization)
            .expect(200);
        expect(await online()).toEqual([owner.id]);
        expect(await online(member)).toEqual([member.id]);
        await request(app).post('/users/logout').set('Authorization', owner.authorization).expect(200);
        await vi.waitFor(() => expect(sockets[0].connected).toBe(false));
    } finally {
        sockets.forEach((socket) => socket.disconnect());
    }
});
