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
