import { addCounterAmount, counterValueSchema } from '@tally/core/client';
import { z } from 'zod';

import { CounterStorage } from './counter-storage';
import { SyncQueue } from './sync-queue';
import { assertSession } from './session-scope';
import { widgetBridge } from './widget-bridge';

import type { ClientCounter } from '@tally/core/client';
import type { SessionScope } from './session-scope';

const tapsSchema = z.array(
    z.object({
        id: z.uuid(),
        owner: z.string().min(1),
        counterId: z.string().min(1),
        amount: counterValueSchema,
    }),
);

export const pendingWidgetTaps = () => (widgetBridge ? tapsSchema.parse(JSON.parse(widgetBridge.pending())) : []);

export const WidgetSync = {
    async publish(counters: ClientCounter[], scope: SessionScope) {
        if (!widgetBridge) return;
        const { widgetReceipts } = await CounterStorage.getState();
        assertSession(scope);
        widgetBridge.publish(
            scope.userId || 'guest',
            JSON.stringify(
                counters.map(({ id, title, count, increment, metric }) => ({ id, title, count, increment, metric })),
            ),
            widgetReceipts,
        );
    },

    async consume(scope: SessionScope, discardMissing = false): Promise<ClientCounter[] | null> {
        const bridge = widgetBridge;
        if (!bridge) return null;
        // The provider calls this inside writeSession, together with its counter mutation.
        // This keeps a widget import from racing an app tap that has not reached storage yet.
        assertSession(scope);
        const taps = pendingWidgetTaps().filter(
            (tap) => tap.owner === (scope.userId || 'guest') || tap.owner === 'guest',
        );
        if (!taps.length) return null;
        const state = await CounterStorage.getState();
        const pendingIds = new Set(taps.map((tap) => tap.id));
        const receipts = new Set(state.widgetReceipts.filter((id) => pendingIds.has(id)));
        const counters = state.counters.map((counter) => ({ ...counter }));
        const accepted = taps.filter((tap) => {
            const counter = counters.find((item) => item.id === tap.counterId);
            return (
                counter &&
                (counter.userId === tap.owner ||
                    counter.shares?.some((share) => share.userId === tap.owner && share.status === 'ACCEPTED'))
            );
        });
        if (!accepted.length && !discardMissing) return null;
        for (const tap of accepted) {
            if (receipts.has(tap.id)) continue;
            const counter = counters.find((item) => item.id === tap.counterId)!;
            const count = counterValueSchema.safeParse(addCounterAmount(counter.count, tap.amount));
            // Keep the journal if another device moved the count to its limit.
            if (!count.success) throw new RangeError('Widget changes exceed the counter limit.');
            counter.count = count.data;
            receipts.add(tap.id);
        }
        assertSession(scope);
        await CounterStorage.saveState({ counters, widgetReceipts: [...receipts] });
        for (const tap of accepted) {
            assertSession(scope);
            if (tap.owner === 'guest') continue; // The existing guest consolidation sends the final count.
            await SyncQueue.add({
                id: tap.id,
                queuedByUserId: tap.owner,
                type: 'INCREMENT',
                entityId: tap.counterId,
                payload: { amount: tap.amount },
            });
        }
        assertSession(scope);
        // Keep the journal until both the local count and server command are durable.
        bridge.acknowledge((discardMissing ? taps : accepted).map((tap) => tap.id));
        // Prune receipts on the next import, not after acknowledgement. A failed cleanup
        // write must not leave the in-memory count behind the saved count.
        return counters.filter(
            (counter) =>
                counter.userId === 'guest' ||
                counter.userId === scope.userId ||
                counter.shares?.some((share) => share.userId === scope.userId && share.status === 'ACCEPTED'),
        );
    },
};
