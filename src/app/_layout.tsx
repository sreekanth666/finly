import '@/global.css';

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Uniwind } from 'uniwind';

import migrations from '../../drizzle/migrations';
import { scheduleCarryOverFlush } from '@/db/carry-over';
import { db, openError } from '@/db/client';
import { toError } from '@/db/errors';
import { getCurrency, getFlag } from '@/db/repositories/settings';
import { runSeed } from '@/db/seed';
import { AppLock } from '@/features/security/app-lock';
import { MigrationFailureScreen } from '@/features/recovery/migration-failure-screen';
import { setActiveCurrency } from '@/domain/money';
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
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const router = useRouter();

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
      /* Applied before the first render, so no screen ever paints in the wrong
         currency and then corrects itself. */
      setActiveCurrency(getCurrency());
      /* Read once at boot rather than live: re-reading would re-lock the app the
         moment the user turned the setting on. */
      setIsAppLockEnabled(getFlag('app_lock_enabled'));
      /* Read once, not live: re-reading would bounce the user back into the
         flow the instant it wrote onboarding_done. */
      setNeedsOnboarding(!getFlag('onboarding_done'));
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

  useEffect(() => {
    /* Covers a crash between a write and its recompute, and a month rolling
       over while the app was closed. */
    if (databaseSettled && fatal === null) scheduleCarryOverFlush();
  }, [databaseSettled, fatal]);

  useEffect(() => {
    /* §5: categories and a budget are seeded, accounts deliberately are not —
       "the user adds their own, prompted once". This is that prompt.

       Navigated to imperatively rather than with a <Redirect>. A layout drops
       every child that isn't a Screen (expo-router warns "Layout children must
       be of type Screen, all other children are ignored" and returns null), so
       a <Redirect> placed inside the Stack never ran and first launch went
       straight to the tabs. The effect fires after the Stack has mounted, and
       `needsOnboarding` is read once at boot, so it fires exactly once. */
    if (!fontsSettled || !databaseSettled || fatal !== null) return;
    if (!needsOnboarding) return;
    router.replace('/onboarding');
  }, [fontsSettled, databaseSettled, fatal, needsOnboarding, router]);

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
            <AppLock isEnabled={isAppLockEnabled}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              {/* Entry is a task, not a destination — it comes up over the tabs. */}
              <Stack.Screen name="expense/new" options={{ presentation: 'modal' }} />
              {/* Detail is a destination, so it pushes; editing is a task, so it doesn't. */}
              <Stack.Screen name="expense/[id]/index" />
              <Stack.Screen name="expense/[id]/edit" options={{ presentation: 'modal' }} />
              <Stack.Screen name="rule/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="rule/[id]" options={{ presentation: 'modal' }} />
              {/* A destination reached from the avatar on every tab, so it
                  pushes rather than coming up as a task. */}
              <Stack.Screen name="profile" />
              {/* Settings is a section you navigate into, so every screen pushes. */}
              <Stack.Screen name="settings/index" />
              <Stack.Screen name="settings/budget" />
              <Stack.Screen name="settings/categories" />
              <Stack.Screen name="settings/accounts/index" />
              <Stack.Screen name="settings/accounts/new" />
              <Stack.Screen name="settings/accounts/[id]" />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              <Stack.Screen name="settings/security" />
              <Stack.Screen name="settings/currency" />
              <Stack.Screen name="settings/data" />
              {/* Import is a task with its own steps, so it comes up over settings. */}
              <Stack.Screen name="settings/import" options={{ presentation: 'modal' }} />
            </Stack>
            </AppLock>
          )}
        </ThemeProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
