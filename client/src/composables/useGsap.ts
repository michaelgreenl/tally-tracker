import { onUnmounted, shallowRef } from 'vue';
import { gsap } from 'gsap';

import type { Ref } from 'vue';

export function useGsap(scope?: Ref<HTMLElement | null | undefined>) {
    const ctx = shallowRef<gsap.Context | null>(null);

    const init = () => {
        if (!ctx.value) {
            ctx.value = gsap.context(() => {}, scope?.value ?? undefined);
        }
    };

    const registerAnim = (animationLogic: (defaults: any) => void) => {
        return (userOptions: Record<string, any> = {}) => {
            init();

            const defaults = {
                tl: gsap.timeline(),
                delay: 0,
                onComplete: () => {},
                onStart: () => {},
                ...userOptions,
            };

            ctx.value?.add(() => {
                animationLogic(defaults);
            });

            return defaults.tl;
        };
    };

    onUnmounted(() => {
        ctx.value?.revert();
    });

    return {
        registerAnim,
        ctx,
    };
}
