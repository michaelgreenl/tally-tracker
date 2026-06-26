import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent } from 'vue';
import { Network } from '@capacitor/network';
import { useNetwork } from '../useNetwork';

vi.mock('@capacitor/network', () => ({
    Network: {
        getStatus: vi.fn(),
        addListener: vi.fn(),
        removeAllListeners: vi.fn(),
    },
}));

describe('useNetwork', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('removes only its own network listener on unmount', async () => {
        const remove = vi.fn().mockResolvedValue(undefined);

        vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
        vi.mocked(Network.addListener).mockResolvedValue({ remove });

        const wrapper = mount(
            defineComponent({
                setup() {
                    useNetwork();
                    return () => null;
                },
            }),
        );

        await flushPromises();
        wrapper.unmount();

        expect(remove).toHaveBeenCalledOnce();
        expect(Network.removeAllListeners).not.toHaveBeenCalled();
    });
});
