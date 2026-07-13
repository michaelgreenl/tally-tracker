import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { Network } from '@capacitor/network';
import { useNetwork } from '../useNetwork';

import type { VueWrapper } from '@vue/test-utils';
import type { ConnectionStatus } from '@capacitor/network';

vi.mock('@capacitor/network', () => ({
    Network: {
        getStatus: vi.fn(),
        addListener: vi.fn(),
        removeAllListeners: vi.fn(),
    },
}));

const NetworkHost = defineComponent({
    setup() {
        const { isOnline } = useNetwork();
        return () => h('output', { 'data-testid': 'network-status' }, isOnline.value ? 'online' : 'offline');
    },
});

describe('useNetwork', () => {
    let statusChangeListener: ((status: ConnectionStatus) => void) | undefined;
    let wrapper: VueWrapper | undefined;
    let removeListener: () => Promise<void>;

    beforeEach(() => {
        statusChangeListener = undefined;
        removeListener = vi.fn(async () => undefined);
        vi.mocked(Network.getStatus).mockReset();
        vi.mocked(Network.addListener).mockReset();
        vi.mocked(Network.removeAllListeners).mockReset();
        vi.mocked(Network.addListener).mockImplementation(async (_eventName, listener) => {
            statusChangeListener = listener;
            return { remove: removeListener };
        });
    });

    afterEach(() => {
        wrapper?.unmount();
        wrapper = undefined;
    });

    it('renders the initial network status reported on mount', async () => {
        vi.mocked(Network.getStatus).mockResolvedValue({ connected: false, connectionType: 'none' });

        wrapper = mount(NetworkHost);
        await flushPromises();

        expect(wrapper.get('[data-testid="network-status"]').text()).toBe('offline');
    });

    it('renders networkStatusChange updates', async () => {
        vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });

        wrapper = mount(NetworkHost);
        await flushPromises();
        expect(wrapper.get('[data-testid="network-status"]').text()).toBe('online');

        statusChangeListener?.({ connected: false, connectionType: 'none' });
        await nextTick();

        expect(wrapper.get('[data-testid="network-status"]').text()).toBe('offline');
    });

    it('removes only its own network listener on unmount', async () => {
        vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });

        wrapper = mount(NetworkHost);
        await flushPromises();
        wrapper.unmount();
        wrapper = undefined;

        expect(removeListener).toHaveBeenCalledOnce();
        expect(Network.removeAllListeners).not.toHaveBeenCalled();
    });
});
