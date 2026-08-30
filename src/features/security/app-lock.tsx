/**
 * The biometric gate, opt-in and off by default (P4).
 *
 * Locks on cold start and again on resume, but only after a grace period —
 * without one, glancing at a notification and coming straight back would demand
 * a fingerprint, which is the fastest way to make someone turn the feature off.
 *
 * If the device has no biometrics enrolled the gate stands aside rather than
 * locking the user out of their own data: a passcode fallback is offered by
 * `authenticateAsync`, and where even that is unavailable there is nothing to
 * authenticate against.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { Typography } from 'heroui-native';
import { Lock } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';

/** Long enough to answer a message, short enough to still be a lock. */
const GRACE_MS = 60_000;

export type AppLockProps = {
  isEnabled: boolean;
  children: ReactNode;
};

export function AppLock({ isEnabled, children }: AppLockProps) {
  const [isUnlocked, setIsUnlocked] = useState(!isEnabled);
  const [error, setError] = useState<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  const authenticate = useCallback(async () => {
    setError(null);

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      // Nothing to authenticate against. Standing aside beats locking the user
      // out of a local-only database with no recovery path.
      setIsUnlocked(true);
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Finly',
      cancelLabel: 'Cancel',
    });

    if (result.success) {
      setIsUnlocked(true);
    } else {
      setError('Unlock cancelled.');
    }
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      setIsUnlocked(true);
      return;
    }
    void authenticate();
  }, [isEnabled, authenticate]);

  useEffect(() => {
    if (!isEnabled) return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current ??= Date.now();
        return;
      }

      if (state !== 'active') return;
      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (since !== null && Date.now() - since > GRACE_MS) {
        setIsUnlocked(false);
        void authenticate();
      }
    });

    return () => subscription.remove();
  }, [isEnabled, authenticate]);

  if (isUnlocked) return <>{children}</>;

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-background px-8">
      <Icon icon={Lock} color="muted" size={28} />
      <Typography type="h4" weight="semibold">
        Finly is locked
      </Typography>
      <Typography type="body-sm" color="muted" className="text-center">
        {error ?? 'Unlock to see your expenses.'}
      </Typography>
      <View className="pt-2">
        <Button label="Unlock" onPress={() => void authenticate()} />
      </View>
    </SafeAreaView>
  );
}
