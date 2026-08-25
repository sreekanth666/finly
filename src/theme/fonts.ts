/**
 * Font faces, loaded at runtime by the root layout.
 *
 * The keys are the family names the style layer refers to — they must stay in
 * sync with `--font-normal` / `--font-medium` / `--font-semibold` / `--font-bold`
 * and `--font-display` in theme/typography.css.
 *
 * Loading at runtime rather than embedding through the expo-font config plugin
 * keeps the app working in Expo Go, where plugin-registered fonts don't exist.
 * The cost is a short load before first paint, which the splash screen covers.
 */
export const appFonts = {
  'Inter-Regular': require('@/assets/fonts/Inter-Regular.ttf'),
  'Inter-Medium': require('@/assets/fonts/Inter-Medium.ttf'),
  'Inter-SemiBold': require('@/assets/fonts/Inter-SemiBold.ttf'),
  'Inter-Bold': require('@/assets/fonts/Inter-Bold.ttf'),
  'ArchivoBlack-Regular': require('@/assets/fonts/ArchivoBlack-Regular.ttf'),
};
