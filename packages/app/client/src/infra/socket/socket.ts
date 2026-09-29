import { AppState, Platform } from 'react-native';
import { io } from 'socket.io-client';

import { API_URL } from '../http/api';
import { AuthService } from '../../services/auth/auth.service';
import { getSessionScope } from '../../services/session/session-scope';

const socket = io(API_URL || undefined, {
    autoConnect: false,
    // Metro owns WebSocket upgrades; dev web uses the same-origin HTTP proxy.
    transports: Platform.OS === 'web' && __DEV__ ? ['polling'] : ['websocket', 'polling'],
    // Native sockets use tokens, not a browser origin. iOS otherwise supplies the API's origin.
    extraHeaders: Platform.OS === 'web' ? undefined : { Origin: '' },
    withCredentials: true,
    auth: async (callback) => {
        const scope = getSessionScope();
        const token = Platform.OS === 'web' ? null : await AuthService.getAccessToken();
        if (scope !== getSessionScope()) return;
        callback({ userId: scope.userId, ...(token ? { token } : {}) });
    },
});

export const connectSocket = () => {
    if (!socket.connected && !socket.active) {
        const scope = getSessionScope();
        scope.signal.addEventListener('abort', disconnectSocket, { once: true });
        socket.once('disconnect', () => scope.signal.removeEventListener('abort', disconnectSocket));
        socket.connect();
    }
};

export const disconnectSocket = () => {
    if (socket.connected || socket.active) socket.disconnect();
};

export const updatePresence = (state = AppState.currentState) => {
    // Do not queue an old foreground state while disconnected.
    if (socket.connected) socket.emit('presence', state === 'active');
};

socket.on('session-ready', () => updatePresence());

export const subscribeToPresence = (listener: () => void, onDisconnect: () => void) => {
    socket.on('presence-changed', listener);
    socket.on('counters-changed', listener);
    socket.on('session-ready', listener);
    socket.on('disconnect', onDisconnect);
    return () => {
        socket.off('presence-changed', listener);
        socket.off('counters-changed', listener);
        socket.off('session-ready', listener);
        socket.off('disconnect', onDisconnect);
    };
};

socket.on('disconnect', (reason) => {
    if (reason !== 'io server disconnect') return;
    const scope = getSessionScope();
    if (!scope.userId) return;
    // Expiry requires fresh credentials; revocation ends the local session instead.
    void AuthService.checkAuth()
        .then(() => {
            if (scope === getSessionScope()) connectSocket();
        })
        .catch(() => undefined);
});

export const subscribeToCounterUpdates = (listener: () => void, onConnect: () => void) => {
    socket.on('counter-update', listener);
    socket.on('counters-changed', listener);
    socket.on('session-ready', onConnect);
    return () => {
        socket.off('counter-update', listener);
        socket.off('counters-changed', listener);
        socket.off('session-ready', onConnect);
    };
};
