import { ref, onMounted, onUnmounted } from 'vue';

export function useBreakpoints() {
    const isSmPhone = ref(false);
    const isMobile = ref(false);
    const isLgDesktop = ref(false);
    const isXlDesktop = ref(false);

    const update = () => {
        const width = window.innerWidth;

        isSmPhone.value = width < 400;
        isMobile.value = width < 682;
        isLgDesktop.value = width > 1200;
        isXlDesktop.value = width > 1600;
    };

    onMounted(() => {
        window.addEventListener('resize', update);
        update();
    });

    onUnmounted(() => {
        window.removeEventListener('resize', update);
    });

    return { isSmPhone, isMobile, isLgDesktop, isXlDesktop };
}
