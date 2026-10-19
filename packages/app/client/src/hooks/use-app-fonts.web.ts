import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';

import { fonts } from '../theme/fonts';

// expo-font's web loader registers one file per family, so register each weight under one family.
const faces = {
    400: require('../../assets/fonts/Quicksand-Regular.ttf'),
    500: require('../../assets/fonts/Quicksand-Medium.ttf'),
    600: require('../../assets/fonts/Quicksand-SemiBold.ttf'),
    700: require('../../assets/fonts/Quicksand-Bold.ttf'),
};

// Cached across mounts: account changes remount the navigator, which must not drop back to the loading screen.
let result: [boolean, Error | null] = [false, null];
let loading: Promise<void> | undefined;

function loadFonts() {
    loading ??= Promise.all(
        Object.entries(faces).map(async ([weight, source]) => {
            const face = new FontFace(fonts.display, `url(${Asset.fromModule(source).uri})`, { weight });
            document.fonts.add(await face.load());
        }),
    ).then(
        () => {
            result = [true, null];
        },
        (error: Error) => {
            result = [false, error];
        },
    );
    return loading;
}

export function useAppFonts() {
    const [state, setState] = useState(result);

    useEffect(() => {
        void loadFonts().then(() => setState(result));
    }, []);

    return state;
}
