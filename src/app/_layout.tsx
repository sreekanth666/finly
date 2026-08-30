import '@/global.css';

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Uniwind } from 'uniwind';

import migrations from '../../drizzle/migrations';
import { db, openError } from '@/db/client';
import { toError } from '@/db/errors';
import { runSeed } from '@/db/seed';
import { MigrationFailureScreen } from '@/features/recovery/migration-failure-screen';
import { useAppColor } from '@/theme';
import { appFonts } from '@/theme/fonts';

/**
 * Zenith ships a single dark palette (see src/theme/tokens.css), so the theme is
 * pinned here instead of following the device. Switch to `'system'` once a light
 * palette exists.
 */
Uniwind.setTheme('dark');

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  /*
   * Every hook lives above the single early return, without exception. The gate
   * below used to be the only one and could never flip after first render; now
   * that migrations and seeding are asynchronous it flips on every launch, and a
   * hook placed underneath would change the hook count between renders.
   */
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const { success: migrated, error: migrationError } = useMigrations(db, migrations);
  const [isSeeded, setIsSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const [background, surface, foreground, border, accent] = useAppColor([
    'background',
    'surface',
    'foreground',
    'border',
    'accent',
  ]);

  useEffect(() => {
    if (!migrated) return;
    try {
      runSeed();
      setIsSeeded(true);
      setSeedError(null);
    } catch (cause) {
      setSeedError(toError(cause));
    }
  }, [migrated, retryToken]);

  // Falling back to system faces beats a permanently stuck splash screen.
  const fontsSettled = fontsLoaded || Boolean(fontError);
  const fatal = openError ?? migrationError ?? seedError ?? null;
  const databaseSettled = (migrated && isSeeded) || fatal !== null;

  useEffect(() => {
    if (fontsSettled && databaseSettled) {
      SplashScreen.hideAsync();
    }
  }, [fontsSettled, databaseSettled]);

  if (!fontsSettled || !databaseSettled) {
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
          {/* The recovery screen renders inside the providers so it can use the
              token layer, but instead of the Stack: no route may mount against a
              database that failed to migrate. */}
          {fatal !== null ? (
            <MigrationFailureScreen
              error={fatal}
              onRetry={() => {
                setSeedError(null);
                setRetryToken((token) => token + 1);
              }}
            />
          ) : (
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
          )}
        </ThemeProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
