import '@/global.css';

import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Uniwind } from 'uniwind';

import { useAppColor } from '@/theme';
import { appFonts } from '@/theme/fonts';

/**
 * Zenith ships a single dark palette (see src/theme/tokens.css), so the theme is
 * pinned here instead of following the device. Switch to `'system'` once a light
 * palette exists.
 */
Uniwind.setTheme('dark');

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);

  const [background, surface, foreground, border, accent] = useAppColor([
    'background',
    'surface',
    'foreground',
    'border',
    'accent',
  ]);

  useEffect(() => {
    // Render on a font failure too — falling back to system faces beats a
    // permanently stuck splash screen.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

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
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            {/* Entry is a task, not a destination — it comes up over the tabs. */}
            <Stack.Screen name="expense/new" options={{ presentation: 'modal' }} />
            {/* Detail is a destination, so it pushes; editing is a task, so it doesn't. */}
            <Stack.Screen name="expense/[id]/index" />
            <Stack.Screen name="expense/[id]/edit" options={{ presentation: 'modal' }} />
            <Stack.Screen name="rule/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="rule/[id]" options={{ presentation: 'modal' }} />
            {/* Settings is a section you navigate into, so every screen pushes. */}
            <Stack.Screen name="settings/index" />
            <Stack.Screen name="settings/budget" />
            <Stack.Screen name="settings/categories" />
            <Stack.Screen name="settings/accounts/index" />
            <Stack.Screen name="settings/accounts/new" />
            <Stack.Screen name="settings/accounts/[id]" />
            <Stack.Screen name="settings/data" />
            {/* Import is a task with its own steps, so it comes up over settings. */}
            <Stack.Screen name="settings/import" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
