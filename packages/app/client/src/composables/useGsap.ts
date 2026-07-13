// Scoped GSAP context tied to a component's lifecycle.
// All animations registered via registerAnim are auto-reverted on unmount.

import { onUnmounted, shallowRef } from 'vue';
import { gsap } from 'gsap';

import type { Ref } from 'vue';

export interface AnimationDefaults {
    tl: gsap.core.Timeline;
    delay: number;
    onComplete: () => void;
    onStart: () => void;
}

export function useGsap(scope?: Ref<HTMLElement | null | undefined>) {
    const ctx = shallowRef<gsap.Context | null>(null);

    const init = () => {
        if (!ctx.value) {
            ctx.value = gsap.context(() => {}, scope?.value ?? undefined);
        }
    };

    const registerAnim = <TOptions extends Record<string, unknown>>(
        animationLogic: (defaults: AnimationDefaults & TOptions) => void,
    ) => {
        return (userOptions: Partial<AnimationDefaults & TOptions> = {}) => {
            init();

            const defaults = {
                tl: gsap.timeline(),
                delay: 0,
                onComplete: () => {},
                onStart: () => {},
                ...userOptions,
            } as AnimationDefaults & TOptions;

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
