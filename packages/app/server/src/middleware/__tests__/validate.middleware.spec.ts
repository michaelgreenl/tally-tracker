import express from 'express';
import request from 'supertest';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { validate } from '../validate.middleware.js';

it('passes parsed values to the route without changing other requests', async () => {
    const app = express();
    app.use(express.json());
    const schema = z.object({
        body: z.object({ name: z.string().trim(), count: z.number().default(0) }),
        params: z.object({ id: z.string().trim() }),
        query: z.object({ limit: z.coerce.number().int() }),
    });
    const read = (req: express.Request, res: express.Response) =>
        res.json({ body: req.body, params: req.params, query: req.query });
    app.post('/parsed/:id', validate(schema), read);
    app.post('/raw/:id', read);

    const parsed = await request(app)
        .post('/parsed/%20counter%20?limit=5&ignored=true')
        .send({ name: ' Water ', ignored: 'not accepted' })
        .expect(200);
    expect(parsed.body).toEqual({
        body: { name: 'Water', count: 0 },
        params: { id: 'counter' },
        query: { limit: 5 },
    });

    const raw = await request(app).post('/raw/counter?limit=2').send({ name: ' Unchanged ' }).expect(200);
    expect(raw.body).toEqual({ body: { name: ' Unchanged ' }, params: { id: 'counter' }, query: { limit: '2' } });
});
