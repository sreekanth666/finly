import '@/global.css';

import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Uniwind } from 'uniwind';

import { useAppColor } from '@/theme';

/**
 * Zenith ships a single dark palette (see src/theme/tokens.css), so the theme is
 * pinned here instead of following the device. Switch to `'system'` once a light
 * palette exists.
 */
Uniwind.setTheme('dark');

export default function RootLayout() {
  const [background, surface, foreground, border, accent] = useAppColor([
    'background',
    'surface',
    'foreground',
    'border',
    'accent',
  ]);

  const navigationTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background,
      card: surface,
      text: foreground,
      border,
      primary: accent,
    },
  };

  return (
    <GestureHandlerRootView className="flex-1 bg-background">
      <HeroUINativeProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
