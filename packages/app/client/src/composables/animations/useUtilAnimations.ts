import { gsap } from 'gsap';
import { useGsap } from '@/composables/useGsap';
import Flip from 'gsap/Flip';

gsap.registerPlugin(Flip);

interface AnimationOptions {
    selector?: string | Element | null;
    opts?: gsap.TweenVars;
    onComplete?: () => void;
}

interface FlipAnimationOptions {
    state?: Flip.FlipState;
    opts?: Flip.FromToVars;
    onComplete?: () => void;
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
            ...(opts ?? {}),
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
            ...(opts ?? {}),
            onComplete,
        });
    });

    const flipFrom = ({ state, opts, onComplete = () => {} }: FlipAnimationOptions) => {
        if (!state) return;
        Flip.from(state, {
            duration: 0.3,
            ease: 'power3.out',
            ...(opts ?? {}),
            onComplete,
        });
    };

    return {
        fadeIn,
        fadeOut,
        flipFrom,
    };
}
