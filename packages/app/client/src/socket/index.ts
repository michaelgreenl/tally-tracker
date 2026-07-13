import { io, Socket } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const ACCESS_TOKEN_KEY = 'access_token';

const getSocketAuth = async () => {
    if (!Capacitor.isNativePlatform()) return {};

    const { value: token } = await Preferences.get({ key: ACCESS_TOKEN_KEY });
    return token ? { token } : {};
};

const socket: Socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: false,
    withCredentials: true,
    auth: async (callback) => {
        callback(await getSocketAuth());
    },
});

export const connectSocket = () => {
    if (!socket.connected && !socket.active) {
        socket.connect();
    }
};

export const disconnectSocket = () => {
    if (socket.connected || socket.active) {
        socket.disconnect();
    }
};

socket.on('connect', () => {
    console.log('Client connected: ', socket.id);
});

socket.on('disconnect', () => {
    console.log('Client disconnected');
});

export default socket;
