import { CREATED, BAD_REQUEST, NOT_FOUND, CONFLICT, SERVER_ERROR } from '../../constants/status-codes.js';
import * as counterRepository from '../../db/repositories/counter.repository.js';

import type { Request, Response } from 'express';
import type { ShareStatusType } from '../../types/shared/generated/index.js';
import type { CounterResponse } from '../../types/shared/responses.d.ts';
import type {
    CreateCounterRequest,
    UpdateCounterRequest,
    IncrementCounterRequest,
    JoinCounterRequest,
    UpdateShareRequest,
} from '../../types/shared/requests.d.ts';

export const post = async (req: Request<{}, {}, CreateCounterRequest>, res: Response<CounterResponse>) => {
    try {
        const userId = req.user?.id;
        const { id, title, count, color, type, inviteCode } = req.body;

        if (!userId) {
            return res.status(BAD_REQUEST).json({ success: false, message: 'Invalid userId' });
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
                message: 'Invalid userId or counterId',
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

export const getAllByUser = async (req: Request, res: Response<CounterResponse>) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(BAD_REQUEST).json({ success: false, message: 'Invalid userId' });
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
            return res.status(BAD_REQUEST).json({ success: false, message: 'Invalid userId' });
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
                message: 'Invalid userId',
            });
        }

        const counter = await counterRepository.increment({ counterId, userId, amount });

        if (!counter) {
            return res.status(NOT_FOUND).json({ success: false, message: 'Counter not found' });
        }

        // Broadcast to all participants (owner + accepted sharers) via user-scoped socket rooms
        const participants = await counterRepository.getParticipants(counterId);
        const io = req.app.get('io');

        participants.forEach((participantId) => {
            io.to(participantId).emit('counter-update', counter);
        });

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

export const join = async (req: Request<{}, {}, JoinCounterRequest>, res: Response<CounterResponse>) => {
    try {
        const userId = req.user?.id;
        const { inviteCode } = req.body;

        if (!userId || !inviteCode) {
            return res.status(BAD_REQUEST).json({ success: false, message: 'Invalid userId or inviteCode' });
        }

        const counter = await counterRepository.join(inviteCode);

        if (!counter) {
            return res.status(NOT_FOUND).json({ success: false, message: 'Invalid or expired invite link' });
        }

        if (counter.userId === userId) {
            return res.status(CONFLICT).json({ success: false, message: 'User owns this counter' });
        }

        const existingShare = counter.shares.find((s) => s.userId === userId);

        if (existingShare && existingShare.status === ('ACCEPTED' as ShareStatusType)) {
            return res.json({ success: true, message: 'Already joined', data: { counter } });
        }

        const shareUpdates = {
            counterId: counter.id,
            userId,
            status: 'ACCEPTED' as ShareStatusType,
        };

        if (!existingShare) {
            await counterRepository.createShare(shareUpdates);
        } else {
            // Previously rejected — flip back to accepted (re-join)
            await counterRepository.updateShare(shareUpdates);
        }

        return res.status(CREATED).json({
            success: true,
            message: 'Shared counter successfully joined',
            data: { counter },
        });
    } catch (error: any) {
        console.error('Join Error:', error);
        return res.status(SERVER_ERROR).json({ success: false, message: 'Server error: ' + error.message });
    }
};

export const removeShare = async (req: Request<{ counterId: string }, {}, UpdateShareRequest>, res: Response) => {
    try {
        const userId = req.user?.id;
        const counterId = req.params.counterId as string;

        if (!userId || !counterId) {
            return res.status(BAD_REQUEST).json({ success: false, message: 'Invalid userId or counterId' });
        }

        const counter = await counterRepository.getByIdOrShare({ counterId, userId });

        if (!counter) {
            return res.status(NOT_FOUND).json({ success: false, message: 'Counter not found' });
        }

        if (counter.userId === userId) {
            return res.status(CONFLICT).json({ success: false, message: 'User owns this counter' });
        }

        await counterRepository.updateShare({
            counterId: counter.id,
            userId,
            status: 'REJECTED' as ShareStatusType,
        });

        return res.json({
            success: true,
            message: 'Shared counter successfully removed',
        });
    } catch (error: any) {
        console.error('Remove Shared Counter Error: ', error);
        return res.status(SERVER_ERROR).json({ success: false, message: 'Server error: ' + error.message });
    }
};
