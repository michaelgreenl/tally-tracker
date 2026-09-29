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

async function account(username = randomUUID().replaceAll('-', '')) {
    const credentials = { email: `member-${randomUUID()}@example.com`, password: 'Member-password1', username };
    await request(app).post('/users').send(credentials).expect(201);
    const login = await request(app).post('/users/login').send(credentials).expect(200);
    return {
        id: login.body.data.user.id as string,
        authorization: `Bearer ${login.body.data.accessToken}`,
        credentials,
    };
}

it('checks availability before registration and rejects a concurrent case-insensitive claim', async () => {
    const credentials = ['Alex_1', 'aLeX_1'].map((username) => ({
        email: `signup-${randomUUID()}@example.com`,
        password: 'Member-password1',
        username,
    }));
    for (const { username } of credentials) {
        const response = await request(app).post('/users/username/availability').send({ username }).expect(200);
        expect(response.body.data).toEqual({ available: true });
    }
    const results = await Promise.all(credentials.map((data) => request(app).post('/users').send(data)));
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    const winner = credentials[results.findIndex(({ status }) => status === 201)];
    const login = await request(app).post('/users/login').send(winner).expect(200);
    expect(login.body.data.user.username).toBe(winner.username);
    expect(login.body.data.user).not.toHaveProperty('usernameKey');
    expect(await prisma.user.count({ where: { email: { in: credentials.map(({ email }) => email) } } })).toBe(1);
    const response = await request(app).post('/users/username/availability').send({ username: 'ALEX_1' }).expect(200);
    expect(response.body.data).toEqual({ available: false });
});

it('requires a valid username at registration without imposing a short length limit', async () => {
    const email = `boundary-${randomUUID()}@example.com`;
    const password = 'Member-password1';
    for (const username of [undefined, 'ab', 'abc def', 'abc!', 'abc\nxyz']) {
        await request(app).post('/users').send({ email, password, username }).expect(422);
        await request(app).post('/users/username/availability').send({ username }).expect(422);
    }
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    for (const username of ['abc', `abc${'def'.repeat(2000)}`]) {
        const user = await account(username);
        const response = await request(app)
            .get('/users/check-auth')
            .set('Authorization', user.authorization)
            .expect(200);
        expect(response.body.data.user.username).toBe(username);
    }
});

it('exposes only accepted members and their latest action on this counter, without replaying activity', async () => {
    const [owner, member, outsider] = await Promise.all([account('Owner_name'), account('Member_name'), account()]);
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

it('lets only the owner remove an accepted participant without removing the counter', async () => {
    const [owner, member, outsider] = await Promise.all([account(), account(), account()]);
    const counter = await prisma.counter.create({
        data: {
            title: 'Shared counter',
            userId: owner.id,
            type: 'SHARED',
            count: 12,
            shares: {
                create: [
                    { userId: member.id, status: 'ACCEPTED' },
                    { userId: outsider.id, status: 'PENDING' },
                ],
            },
        },
    });
    const path = (id: string) => `/counters/${counter.id}/members/${id}`;
    await request(app).delete(path(member.id)).expect(401);
    for (const [actor, target, status] of [
        [member, member.id, 403],
        [member, owner.id, 403],
        [outsider, member.id, 404],
        [owner, owner.id, 409],
        [owner, outsider.id, 404],
        [owner, randomUUID(), 404],
        [owner, 'invalid-id', 422],
    ] as const) {
        await request(app).delete(path(target)).set('Authorization', actor.authorization).expect(status);
    }
    const members = () => request(app).get(`/counters/${counter.id}/members`).set('Authorization', owner.authorization);
    expect((await members()).body.data.map((row: CounterMember) => row.id)).toEqual([owner.id, member.id]);

    await request(app).delete(path(member.id)).set('Authorization', owner.authorization).expect(200);
    expect((await members()).body.data.map((row: CounterMember) => row.id)).toEqual([owner.id]);
    const removedCounters = await request(app).get('/counters').set('Authorization', member.authorization).expect(200);
    expect(removedCounters.body.data.counters).toEqual([]);
    await request(app).get(`/counters/${counter.id}/members`).set('Authorization', member.authorization).expect(404);
    await request(app)
        .put(`/counters/increment/${counter.id}`)
        .set('Authorization', member.authorization)
        .send({ amount: 1 })
        .expect(404);
    const retained = await prisma.counter.findUniqueOrThrow({ where: { id: counter.id } });
    expect({ userId: retained.userId, count: Number(retained.count) }).toEqual({ userId: owner.id, count: 12 });
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
