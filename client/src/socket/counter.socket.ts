import { Socket } from 'socket.io-client';
import { useCounterStore } from '@/stores/counterStore';

import type { ClientCounter } from '@/types/shared/models';

// Inbound real-time updates from the server. Bypasses the service/sync layer
// since there's no local mutation to queue — just state reconciliation.
export const registerCounterListeners = (socket: Socket) => {
    socket.on('counter-update', (updatedCounter: ClientCounter) => {
        console.log('Received Update:', updatedCounter);

        const counterStore = useCounterStore();

        const index = counterStore.counters.findIndex((c) => c.id === updatedCounter.id);
        if (index !== -1) {
            counterStore.counters[index] = {
                ...counterStore.counters[index],
                ...updatedCounter,
            };

            counterStore.saveState();
        }
    });

    return socket;
};
