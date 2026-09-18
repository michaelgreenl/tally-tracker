import { UNPROCESSABLE_ENTITY, SERVER_ERROR } from '@tally/core';
import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError, ZodIssue } from 'zod';

export const validate =
    (schema: ZodType<{ body?: unknown; params?: Request['params']; query?: unknown }>) =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });

            // Controllers must use the values that passed validation, including transforms and defaults.
            if ('body' in parsed) req.body = parsed.body;
            if (parsed.params) req.params = parsed.params;
            if ('query' in parsed) {
                // Express 5 exposes query through a getter; replace it only on this request.
                Object.defineProperty(req, 'query', { value: parsed.query, configurable: true });
            }

            return next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(UNPROCESSABLE_ENTITY).json({
                    success: false,
                    message: 'Validation failed',
                    errors: error.issues.map((e: ZodIssue) => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });
            }

            return res.status(SERVER_ERROR).json({ success: false, message: 'Internal Server Error' });
        }
    };
