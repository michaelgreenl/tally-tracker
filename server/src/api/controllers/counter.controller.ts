import { CREATED, BAD_REQUEST, NOT_FOUND, CONFLICT, SERVER_ERROR } from '../../constants.js';
import * as counterRepository from '../../db/repositories/counter.repository.js';

import type { Request, Response } from 'express';
import type { ShareStatusType } from '../../types/shared/generated/index.js';
import type { CounterResponse } from '../../types/shared/responses.d.ts';
import type {
    CreateCounterRequest,
    UpdateCounterRequest,
    IncrementCounterRequest,
    JoinCounterRequest,
} from '../../types/shared/requests.d.ts';

export const post = async (req: Request<{}, {}, CreateCounterRequest>, res: Response<CounterResponse>) => {
    try {
        const userId = req.user?.id;
        const { id, title, count, color, type, inviteCode } = req.body;

        if (!userId) {
            return res
                .status(BAD_REQUEST)
                .json({ success: false, message: 'Failed to create counter: Invalid userId' });
        }

        const counter = await counterRepository.post({ id, userId, title, count, color, type, inviteCode });

        if (!counter) {
            return res.status(NOT_FOUND).json({ success: false, message: 'Counter not found' });
        }

        res.status(CREATED).json({
            success: true,
            message: 'Counter created successfully',
            data: { counter },
        });
    } catch (error: any) {
        console.error('Counter Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};

export const remove = async (req: Request, res: Response<CounterResponse>) => {
    try {
        const userId = req.user?.id;
        const counterId = req.params.counterId as string;

        if (!userId || !counterId) {
            return res.status(BAD_REQUEST).json({
                success: false,
                message: 'Invalid request: Missing userId or counterId',
            });
        }

        await counterRepository.remove({ counterId, userId });

        res.json({ success: true });
    } catch (error: any) {
        console.error('Counter Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};

export const getById = async (req: Request, res: Response<CounterResponse>) => {
    try {
        const userId = req.user?.id;
        const counterId = req.params.counterId as string;

        if (!userId) {
            return res.status(BAD_REQUEST).json({ success: false, message: 'Failed to get counter: Invalid userId' });
        }

        const counter = await counterRepository.getById({ counterId, userId });

        if (!counter) {
            return res.status(NOT_FOUND).json({ success: false, message: 'Counter not found' });
        } else {
            res.json({ success: true, data: { counter } });
        }
    } catch (error: any) {
        console.error('Counter Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};

export const getAllByUser = async (req: Request, res: Response<CounterResponse>) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(BAD_REQUEST).json({ success: false, message: 'Failed to get counters: Invalid userId' });
        }

        const counters = await counterRepository.getAllByUser(userId);

        if (!counters) {
            return res.status(NOT_FOUND).json({ success: false, message: 'Counters not found' });
        }

        res.json({ success: true, data: { counters } });
    } catch (error: any) {
        console.error('Counter Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};

export const put = async (
    req: Request<{ counterId: string }, {}, UpdateCounterRequest>,
    res: Response<CounterResponse>,
) => {
    try {
        const userId = req.user?.id;
        const counterId = req.params.counterId as string;
        const { title, count, color } = req.body;

        if (!userId) {
            return res
                .status(BAD_REQUEST)
                .json({ success: false, message: 'Failed to update counter: Invalid userId' });
        }

        const counter = await counterRepository.put({ counterId, userId, data: { title, count, color } });

        if (!counter) {
            return res.status(NOT_FOUND).json({ success: false, message: 'Counter not found' });
        }

        res.json({
            success: true,
            message: 'Counter updated successfully',
            data: { counter },
        });
    } catch (error: any) {
        console.error('Counter Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};

export const increment = async (
    req: Request<{ counterId: string }, {}, IncrementCounterRequest>,
    res: Response<CounterResponse>,
) => {
    try {
        const userId = req.user?.id;
        const counterId = req.params.counterId as string;
        const { amount } = req.body;

        if (!userId) {
            return res.status(BAD_REQUEST).json({
                success: false,
                message: 'Failed to increment counter: Invalid userId',
            });
        }

        const counter = await counterRepository.increment({ counterId, userId, amount });

        if (!counter) {
            return res.status(NOT_FOUND).json({ success: false, message: 'Counter not found' });
        }

        res.json({
            success: true,
            message: 'Counter incremented successfully',
            data: { counter },
        });
    } catch (error: any) {
        console.error('Counter Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};

export const join = async (
    req: Request<{ counterId: string }, {}, JoinCounterRequest>,
    res: Response<CounterResponse>,
) => {
    try {
        const userId = req.user?.id;
        const { inviteCode } = req.body;

        if (!userId || !inviteCode) {
            return res.status(BAD_REQUEST).json({ success: false, message: 'Missing data' });
        }

        const counter = await counterRepository.join(inviteCode);

        if (!counter) {
            return res.status(NOT_FOUND).json({ success: false, message: 'Invalid or expired invite link' });
        }

        if (counter.userId === userId) {
            return res.status(CONFLICT).json({ success: false, message: 'User owns this counter' });
        }

        const existingShare = counter.shares.find((s) => s.userId === userId);
        if (existingShare) {
            return res.json({ success: true, message: 'Already joined', data: { counter } });
        }

        await counterRepository.createShare({
            counterId: counter.id,
            userId,
            status: 'ACCEPTED' as ShareStatusType,
        });

        return res.status(CREATED).json({
            success: true,
            message: 'Share counter successfully joined',
            data: { counter },
        });
    } catch (error: any) {
        console.error('Join Error:', error);
        return res.status(SERVER_ERROR).json({ success: false, message: 'Server error' });
    }
};

// TODO:
// export const removeShared = async (req: Request, res: Response) => {
//     try {
//         const userId = req.user?.id;
//         const counterId = req.params.counterId as string;

//         if (!userId || !counterId) {
//             return res.status(BAD_REQUEST).json({ success: false, message: 'Missing data' });
//         }

//         if (counter.userId === userId) {
//             return res.status(CONFLICT).json({ success: false, message: 'User owns this counter' });
//         }
//     } catch (error: any) {
//         console.error('Join Error:', error);
//         return res.status(SERVER_ERROR).json({ success: false, message: 'Server error' });
//     }
// };
