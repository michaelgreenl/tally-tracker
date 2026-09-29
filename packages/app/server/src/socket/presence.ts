import type { Server } from 'socket.io';
import { getSharedParticipantIds } from '../db/repositories/counter.repository.js';

export const getOnlineParticipants = async (io: Server, userId: string) => {
    const participants = await getSharedParticipantIds(userId);
    const sockets = await io.in(participants).fetchSockets();
    return [...new Set(sockets.filter((socket) => socket.data.active).map((socket) => socket.data.userId as string))];
};

export const notifyPresence = async (io: Server, userId: string) => {
    const participants = await getSharedParticipantIds(userId);
    // Send no identity data. Each recipient reads its current authorized participant list.
    io.to(participants).emit('presence-changed');
};
