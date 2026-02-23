import { ref, onMounted, onUnmounted } from 'vue';
import { Network } from '@capacitor/network';

export function useNetwork() {
    const isOnline = ref(true);

    const updateStatus = async () => {
        const status = await Network.getStatus();
        isOnline.value = status.connected;
    };

    onMounted(async () => {
        await updateStatus();
        Network.addListener('networkStatusChange', (status) => {
            isOnline.value = status.connected;
        });
    });

    onUnmounted(() => {
        Network.removeAllListeners();
    });

    return { isOnline };
}
