import { Platform } from 'react-native';
import { io } from 'socket.io-client';

import { API_URL } from './api';
import { AuthService } from './services/auth.service';

import type { ClientCounter } from '@tally/core/client';

const socket = io(API_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: async (callback) => {
        const token = Platform.OS === 'web' ? null : await AuthService.getAccessToken();
        callback(token ? { token } : {});
    },
});

export const connectSocket = () => {
    if (!socket.connected && !socket.active) socket.connect();
};

export const disconnectSocket = () => {
    if (socket.connected || socket.active) socket.disconnect();
};

export const subscribeToCounterUpdates = (listener: (counter: ClientCounter) => void) => {
    socket.on('counter-update', listener);
    return () => socket.off('counter-update', listener);
};
