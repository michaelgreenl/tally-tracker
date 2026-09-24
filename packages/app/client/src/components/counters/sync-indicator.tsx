import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../../theme/colors';

import type { CSSAnimationKeyframes } from 'react-native-reanimated';

// Cloud paths: Ionicons, Copyright (c) 2015-present Ionic. See assets/ionicons-LICENSE.
const rotation: CSSAnimationKeyframes = {
    from: { transform: [{ rotate: '0deg' }] },
    to: { transform: [{ rotate: '360deg' }] },
};

const labels = { syncing: 'Syncing', synced: 'Synced', offline: 'Offline', error: 'Sync failed' };

export function SyncIndicator({ status }: { status: keyof typeof labels }) {
    const reduceMotion = useReducedMotion();
    const color = status === 'error' ? colors.danger : status === 'offline' ? colors.warning : colors.onPrimary;

    return (
        <View
            accessible
            accessibilityRole='image'
            accessibilityLabel={labels[status]}
            accessibilityLiveRegion='polite'
            testID='home-sync-status'
        >
            <View aria-hidden style={styles.icon}>
                <Svg
                    width={28}
                    height={28}
                    viewBox='0 0 512 512'
                    fill='none'
                    stroke={color}
                    strokeWidth={32}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    testID={`home-sync-${status}-icon`}
                >
                    <Path
                        d={
                            status === 'offline'
                                ? 'M93.72 183.25C49.49 198.05 16 233.1 16 288c0 66 54 112 120 112h184.37M467.82 377.74C485.24 363.3 496 341.61 496 312c0-59.82-53-85.76-96-88-8.89-89.54-71-144-144-144-26.16 0-48.79 6.93-67.6 18.14M448 448 64 64'
                                : 'M400 240c-8.89-89.54-71-144-144-144-69 0-113.44 48.2-128 96C68 198 16 235.59 16 304c0 66 54 112 120 112h260c55 0 100-27.44 100-88 0-59.82-53-85.76-96-88Z'
                        }
                    />
                    {status === 'synced' && <Path d='m317 208-107.8 128L163 284.8' />}
                    {status === 'error' && <Path d='m192 208 128 128m0-128-128 128' />}
                </Svg>
                {status === 'syncing' && (
                    <Animated.View
                        testID='home-sync-spinner'
                        style={[
                            styles.spinner,
                            {
                                animationName: reduceMotion ? 'none' : rotation,
                                animationDuration: 800,
                                animationIterationCount: 'infinite',
                                animationTimingFunction: 'linear',
                            },
                        ]}
                    >
                        <Svg width={12} height={12} viewBox='0 0 20 20' fill='none'>
                            <Path
                                d='M10 2a8 8 0 0 1 0 16'
                                stroke={colors.onPrimary}
                                strokeWidth={3}
                                strokeLinecap='round'
                            />
                        </Svg>
                    </Animated.View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    icon: { width: 28, height: 28 },
    spinner: { position: 'absolute', left: 8, top: 9, width: 12, height: 12 },
});
