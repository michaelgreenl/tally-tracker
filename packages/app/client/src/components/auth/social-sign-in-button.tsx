import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

type Props = {
    provider: 'Apple' | 'Google';
    disabled?: boolean;
    busy?: boolean;
    fontFamily?: string;
    onPress: () => void;
};

export function SocialSignInButton({ provider, disabled, busy, fontFamily, onPress }: Props) {
    const testID = `${provider.toLowerCase()}-sign-in`;
    const height = 48;
    return (
        <Pressable
            accessibilityLabel={`Continue with ${provider}`}
            accessibilityRole='button'
            accessibilityState={{ disabled: disabled || busy, busy }}
            disabled={disabled || busy}
            onPress={onPress}
            style={({ pressed }) => [
                styles.button,
                { minHeight: height },
                disabled && styles.disabled,
                pressed && styles.pressed,
            ]}
            testID={testID}
        >
            <View style={[styles.icon, { width: height * 0.75, height }]}>
                {busy ? (
                    <ActivityIndicator color='#1F1F1F' testID={`${testID}-loading`} />
                ) : provider === 'Apple' ? (
                    // Apple's official left-aligned artwork, including its original padding.
                    <Svg aria-hidden width={(height * 31) / 44} height={height} viewBox='0 0 31 44'>
                        <Rect fill='#FFFFFF' width={31} height={44} />
                        <Path
                            fill='#000000'
                            d='M15.7099491,14.8846154 C16.5675461,14.8846154 17.642562,14.3048315 18.28274,13.5317864 C18.8625238,12.8312142 19.2852829,11.852829 19.2852829,10.8744437 C19.2852829,10.7415766 19.2732041,10.6087095 19.2490464,10.5 C18.2948188,10.5362365 17.1473299,11.140178 16.4588366,11.9494596 C15.9152893,12.56548 15.4200572,13.5317864 15.4200572,14.5222505 C15.4200572,14.6671964 15.4442149,14.8121424 15.4562937,14.8604577 C15.5166879,14.8725366 15.6133185,14.8846154 15.7099491,14.8846154 Z M12.6902416,29.5 C13.8618881,29.5 14.3812778,28.714876 15.8428163,28.714876 C17.3285124,28.714876 17.6546408,29.4758423 18.9591545,29.4758423 C20.2395105,29.4758423 21.0971074,28.292117 21.9063891,27.1325493 C22.8123013,25.8038779 23.1867451,24.4993643 23.2109027,24.4389701 C23.1263509,24.4148125 20.6743484,23.4122695 20.6743484,20.5979021 C20.6743484,18.1579784 22.6069612,17.0588048 22.7156707,16.974253 C21.4353147,15.1382708 19.490623,15.0899555 18.9591545,15.0899555 C17.5217737,15.0899555 16.3501271,15.9596313 15.6133185,15.9596313 C14.8161157,15.9596313 13.7652575,15.1382708 12.521138,15.1382708 C10.1536872,15.1382708 7.75,17.0950413 7.75,20.7911634 C7.75,23.0861411 8.64383344,25.513986 9.74300699,27.0842339 C10.6851558,28.4129053 11.5065162,29.5 12.6902416,29.5 Z'
                        />
                    </Svg>
                ) : (
                    // Google's unmodified logo, as rendered by its web sign-in button.
                    <Svg aria-hidden width={(height * 20) / 48} height={(height * 20) / 48} viewBox='0 0 48 48'>
                        <Path
                            fill='#EA4335'
                            d='M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z'
                        />
                        <Path
                            fill='#4285F4'
                            d='M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z'
                        />
                        <Path
                            fill='#FBBC05'
                            d='M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z'
                        />
                        <Path
                            fill='#34A853'
                            d='M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z'
                        />
                    </Svg>
                )}
            </View>
            <Text
                allowFontScaling={false}
                style={[styles.label, { fontFamily }, provider === 'Apple' && styles.appleText]}
                textBreakStrategy='balanced'
                lineBreakStrategyIOS='push-out'
            >
                Continue with {provider}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    // Provider branding stays independent of the app palette.
    button: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#747775',
    },
    icon: { alignItems: 'center', justifyContent: 'center' },
    label: {
        flex: 1,
        paddingVertical: 8,
        paddingRight: 12,
        color: '#1F1F1F',
        fontSize: 48 * 0.43,
        fontWeight: '500',
        textAlign: 'center',
    },
    appleText: { color: '#000000' },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.55 },
});
