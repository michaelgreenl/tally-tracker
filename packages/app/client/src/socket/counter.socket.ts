import { Socket } from 'socket.io-client';

import type { ClientCounter } from '@tally/core';

// Inbound real-time updates from the server. Bypasses the service/sync layer
// since there's no local mutation to queue — just state reconciliation.
export const registerCounterListeners = (
    socket: Socket,
    updateCounter: (counter: ClientCounter) => void | Promise<void>,
) => {
    socket.on('counter-update', (updatedCounter: ClientCounter) => {
        console.log('Received Update:', updatedCounter);
        void updateCounter(updatedCounter);
    });

    return socket as Socket;
};
