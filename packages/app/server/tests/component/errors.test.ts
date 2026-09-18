import { expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

it.each([
    ['malformed JSON', 'application/json', 'parser-secret', 400],
    ['oversized JSON', 'application/json', JSON.stringify({ value: 'x'.repeat(102_400) }), 413],
    ['unsupported charset', 'application/json; charset=unsupported', '{}', 415],
] as const)('returns a safe client error for %s', async (_name, contentType, body, status) => {
    const response = await request(app).post('/users/login').set('Content-Type', contentType).send(body);

    expect(response.status).toBe(status);
    expect(response.body).toEqual({ success: false, message: 'Invalid request.' });
});
