import { useFonts } from 'expo-font';

// Quicksand is embedded natively by the expo-font config plugin in app.json.
export function useAppFonts() {
    return useFonts({ GoogleSansMedium: require('../../assets/fonts/GoogleSans-Medium.ttf') });
}
