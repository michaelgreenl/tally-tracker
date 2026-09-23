export type AppleSignInProps = {
    connect?: boolean;
    disabled: boolean;
    rememberMe?: boolean;
    onBusyChange: (busy: boolean) => void;
    onError: (message: string) => void;
    onSuccess: () => void;
};

// Native Apple authentication is iOS-only. Web and Android retain their existing sign-in options.
export function AppleSignIn(_props: AppleSignInProps) {
    return null;
}
