import { OK, CREATED, BAD_REQUEST, FORBIDDEN, NOT_FOUND, CONFLICT } from '@tally/core';
import * as counterRepository from '../../db/repositories/counter.repository.js';
import * as userRepository from '../../db/repositories/user.repository.js';
import { runIdempotentMutation } from '../../services/idempotency.service.js';

import type { Request, Response } from 'express';
import type { ShareStatusType } from '@tally/core';
import type { CounterResponse } from '@tally/core';
import type {
    CreateCounterRequest,
    UpdateCounterRequest,
    SetCounterCountRequest,
    IncrementCounterRequest,
    JoinCounterRequest,
    UpdateShareRequest,
} from '@tally/core';

const sendMutationResponse = (res: Response, { status, body }: { status: number; body?: unknown }) => {
    if (body === undefined) {
        return res.status(status).send();
    }

    return res.status(status).json(body);
};

export const post = async (
    req: Request<Record<string, never>, CounterResponse, CreateCounterRequest>,
    res: Response<CounterResponse>,
) => {
    const result = await runIdempotentMutation<CounterResponse>(req, async (tx) => {
        const userId = req.user?.id;
        const { id, title, count, color, metric, increment } = req.body;

        if (!userId) {
            return { status: BAD_REQUEST, body: { success: false, message: 'Invalid userId' } };
        }

        const counter = await counterRepository.post({ id, userId, title, count, color, metric, increment }, tx);

        if (!counter) {
            return { status: NOT_FOUND, body: { success: false, message: 'Counter not found' } };
        }

        return {
            status: CREATED,
            body: {
                success: true,
                message: 'Counter created successfully',
                data: { counter },
            },
        };
    });

    const counter = result.body?.data?.counter;
    if (!result.replayed && counter) {
        req.app.get('io').to(counter.userId).emit('counter-update', counter);
    }
    return sendMutationResponse(res, result);
};

export const share = async (req: Request, res: Response<CounterResponse>) => {
    const result = await runIdempotentMutation<CounterResponse>(req, async (tx) => {
        const userId = req.user?.id;
        if (!userId) return { status: BAD_REQUEST, body: { success: false, message: 'Invalid userId' } };

        const user = await userRepository.getUserTierById(userId, tx);
        if (!user) return { status: NOT_FOUND, body: { success: false, message: 'User not found' } };
        if (user.tier !== 'PREMIUM') {
            return { status: FORBIDDEN, body: { success: false, message: 'Sharing requires premium access.' } };
        }

        const counter = await counterRepository.share({ counterId: req.params.counterId as string, userId }, tx);
        if (!counter) return { status: NOT_FOUND, body: { success: false, message: 'Counter not found' } };
        return { status: OK, body: { success: true, data: { counter } } };
    });
    return sendMutationResponse(res, result);
};

export const remove = async (req: Request, res: Response<CounterResponse>) => {
    const result = await runIdempotentMutation<CounterResponse>(req, async (tx) => {
        const userId = req.user?.id;
        const counterId = req.params.counterId as string;

        if (!userId || !counterId) {
            return {
                status: BAD_REQUEST,
                body: {
                    success: false,
                    message: 'Invalid userId or counterId',
                },
            };
        }

        const deleted = await counterRepository.remove({ counterId, userId }, tx);

        if (!deleted) {
            return { status: NOT_FOUND, body: { success: false, message: 'Counter not found' } };
        }

        return { status: OK, body: { success: true } };
    });

    return sendMutationResponse(res, result);
};

export const getAllByUser = async (req: Request, res: Response<CounterResponse>) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(BAD_REQUEST).json({ success: false, message: 'Invalid userId' });
    }

    const counters = await counterRepository.getAllByUser(userId);

    if (!counters) {
        return res.status(NOT_FOUND).json({ success: false, message: 'Counters not found' });
    }

    res.json({ success: true, data: { counters } });
};

export const put = async (
    req: Request<{ counterId: string }, CounterResponse, UpdateCounterRequest>,
    res: Response<CounterResponse>,
) => {
    let participants: string[] = [];
    const result = await runIdempotentMutation<CounterResponse>(req, async (tx) => {
        const userId = req.user?.id;
        const counterId = req.params.counterId as string;
        const { title, color, metric, increment } = req.body;

        if (!userId) {
            return { status: BAD_REQUEST, body: { success: false, message: 'Invalid userId' } };
        }

        const counter = await counterRepository.put(
            { counterId, userId, data: { title, color, metric, increment } },
            tx,
        );

        if (!counter) {
            return { status: NOT_FOUND, body: { success: false, message: 'Counter not found' } };
        }

        participants = await counterRepository.getParticipants(counterId, tx);
        return {
            status: OK,
            body: {
                success: true,
                message: 'Counter updated successfully',
                data: { counter },
            },
        };
    });

    const updatedCounter = result.body?.data?.counter;
    if (!result.replayed && updatedCounter) {
        const io = req.app.get('io');
        participants.forEach((participantId) => io.to(participantId).emit('counter-update', updatedCounter));
    }
    return sendMutationResponse(res, result);
};

export const setCount = async (
    req: Request<{ counterId: string }, CounterResponse, SetCounterCountRequest>,
    res: Response<CounterResponse>,
) => {
    const result = await runIdempotentMutation<CounterResponse>(req, async (tx) => {
        const userId = req.user?.id;
        const counterId = req.params.counterId as string;
        const { count } = req.body;

        if (!userId) {
            return { status: BAD_REQUEST, body: { success: false, message: 'Invalid userId' } };
        }

        const counter = await counterRepository.setCount({ counterId, userId, count }, tx);

        if (!counter) {
            return { status: NOT_FOUND, body: { success: false, message: 'Counter not found' } };
        }

        return {
            status: OK,
            body: {
                success: true,
                message: 'Counter count updated successfully',
                data: { counter },
            },
        };
    });

    return sendMutationResponse(res, result);
};

export const increment = async (
    req: Request<{ counterId: string }, CounterResponse, IncrementCounterRequest>,
    res: Response<CounterResponse>,
) => {
    let participants: string[] = [];
    let counterToBroadcast: unknown;

    const result = await runIdempotentMutation<CounterResponse>(req, async (tx) => {
        const userId = req.user?.id;
        const counterId = req.params.counterId as string;
        const { amount } = req.body;

        if (!userId) {
            return {
                status: BAD_REQUEST,
                body: {
                    success: false,
                    message: 'Invalid userId',
                },
            };
        }

        const counter = await counterRepository.increment({ counterId, userId, amount }, tx);

        if (!counter) {
            return { status: NOT_FOUND, body: { success: false, message: 'Counter not found' } };
        }

        participants = await counterRepository.getParticipants(counterId, tx);
        counterToBroadcast = counter;

        return {
            status: OK,
            body: {
                success: true,
                message: 'Counter incremented successfully',
                data: { counter },
            },
        };
    });

    if (!result.replayed && counterToBroadcast) {
        const io = req.app.get('io');

        participants.forEach((participantId) => {
            io.to(participantId).emit('counter-update', counterToBroadcast);
        });
    }

    return sendMutationResponse(res, result);
};

export const join = async (
    req: Request<Record<string, never>, CounterResponse, JoinCounterRequest>,
    res: Response<CounterResponse>,
) => {
    const result = await runIdempotentMutation<CounterResponse>(req, async (tx) => {
        const userId = req.user?.id;
        const { inviteCode } = req.body;

        if (!userId || !inviteCode) {
            return { status: BAD_REQUEST, body: { success: false, message: 'Invalid userId or inviteCode' } };
        }

        const counter = await counterRepository.join(inviteCode, tx);

        if (!counter || counter.type !== 'SHARED') {
            return { status: NOT_FOUND, body: { success: false, message: 'Invalid or expired invite link' } };
        }

        if (counter.userId === userId) {
            return { status: CONFLICT, body: { success: false, message: 'User owns this counter' } };
        }

        const share = counter.shares.find((item) => item.userId === userId);

        if (share && share.status === ('ACCEPTED' as ShareStatusType)) {
            return { status: OK, body: { success: true, message: 'Already joined', data: { counter } } };
        }

        const user = await userRepository.getUserTierById(userId, tx);

        if (!user) {
            return { status: NOT_FOUND, body: { success: false, message: 'User not found' } };
        }

        if (user.tier === 'BASIC') {
            const total = await counterRepository.countAcceptedJoinedSharesByUserId(userId, tx);

            if (total > 0) {
                return {
                    status: FORBIDDEN,
                    body: {
                        success: false,
                        message: 'Basic accounts can only join one shared counter.',
                    },
                };
            }
        }

        const shareUpdates = {
            counterId: counter.id,
            userId,
            status: 'ACCEPTED' as ShareStatusType,
        };

        if (!share) {
            await counterRepository.createShare(shareUpdates, tx);
        } else {
            // Previously rejected — flip back to accepted (re-join)
            await counterRepository.updateShare(shareUpdates, tx);
        }

        return {
            status: CREATED,
            body: {
                success: true,
                message: 'Shared counter successfully joined',
                data: { counter },
            },
        };
    });

    return sendMutationResponse(res, result);
};

export const removeShare = async (
    req: Request<{ counterId: string }, CounterResponse, UpdateShareRequest>,
    res: Response,
) => {
    const result = await runIdempotentMutation(req, async (tx) => {
        const userId = req.user?.id;
        const counterId = req.params.counterId as string;

        if (!userId || !counterId) {
            return { status: BAD_REQUEST, body: { success: false, message: 'Invalid userId or counterId' } };
        }

        const counter = await counterRepository.getByIdOrShare({ counterId, userId }, tx);

        if (!counter) {
            return { status: NOT_FOUND, body: { success: false, message: 'Counter not found' } };
        }

        if (counter.userId === userId) {
            return { status: CONFLICT, body: { success: false, message: 'User owns this counter' } };
        }

        await counterRepository.updateShare(
            {
                counterId: counter.id,
                userId,
                status: 'REJECTED' as ShareStatusType,
            },
            tx,
        );

        return {
            status: OK,
            body: {
                success: true,
                message: 'Shared counter successfully removed',
            },
        };
    });

    return sendMutationResponse(res, result);
};
