import { ref, onMounted, onUnmounted } from 'vue';
import { Network } from '@capacitor/network';

export function useNetwork() {
    const isOnline = ref(true);
    let networkStatusListener: Awaited<ReturnType<typeof Network.addListener>> | undefined;

    const updateStatus = async () => {
        const status = await Network.getStatus();
        isOnline.value = status.connected;
    };

    onMounted(async () => {
        await updateStatus();
        networkStatusListener = await Network.addListener('networkStatusChange', (status) => {
            isOnline.value = status.connected;
        });
    });

    onUnmounted(() => {
        void networkStatusListener?.remove();
    });

    return { isOnline };
}
