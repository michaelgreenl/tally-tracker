import { gsap } from 'gsap';
import Flip from 'gsap/Flip';
import { useGsap } from '@/composables/useGsap';

gsap.registerPlugin(Flip);

interface AnimationOptions {
    selector?: string | Element | null;
    opts?: gsap.TweenVars;
    onComplete?: () => void;
    state?: Flip.FlipState;
}

export function useUtilAnimations() {
    const { registerAnim } = useGsap();

    const fadeIn = registerAnim(({ selector, opts, onComplete }: AnimationOptions) => {
        if (!selector) return;
        gsap.set(selector, { opacity: 0 });
        gsap.to(selector, {
            duration: 0.2,
            ease: 'linear',
            opacity: 1,
            ...(opts as any),
            onComplete,
        });
    });

    const fadeOut = registerAnim(({ selector, opts, onComplete }: AnimationOptions) => {
        if (!selector) return;
        gsap.set(selector, { opacity: 1 });
        gsap.to(selector, {
            duration: 0.2,
            ease: 'linear',
            opacity: 0,
            ...(opts as any),
            onComplete,
        });
    });

    const flipFrom = ({ state, opts, onComplete = () => { } }: AnimationOptions) => {
        if (!state) return;
        Flip.from(state, {
            duration: 0.3,
            ease: 'power3.out',
            ...(opts as any),
            onComplete,
        });
    };

    return {
        fadeIn,
        fadeOut,
        flipFrom,
    };
}
