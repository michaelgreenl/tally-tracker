import bcrypt from 'bcrypt';
import { TEST_USER_ID } from './counter.fixture.js';

import type { User } from '@prisma/client';
import type { ClientUser } from '@tally/core';

const hashedPassword = bcrypt.hashSync('password123', 10);

export const buildUser = (overrides: Partial<User> = {}): User => ({
    id: TEST_USER_ID,
    email: 'test@test.com',
    password: hashedPassword,
    tier: 'BASIC',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
});

export const buildClientUser = (overrides: Partial<ClientUser> = {}): ClientUser => ({
    id: TEST_USER_ID,
    email: 'test@test.com',
    tier: 'BASIC',
    ...overrides,
});
