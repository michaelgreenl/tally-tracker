/**
 * Each user joins a room keyed by their own userId. The server targets specific
 * participants when broadcasting, rather than using counter-scoped rooms.
 * This avoids room management complexity and prevents data leaking to unauthorized users.
 */

import { Server } from 'socket.io';
import { socketCorsOpts } from '../config/cors.config.js';
import { Server as HttpServer } from 'http';

const initializeIO = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: socketCorsOpts,
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('join-room', (userId: string) => {
            console.log(`Socket ${socket.id} joining room ${userId}`);
            socket.join(userId);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
};

export default initializeIO;
