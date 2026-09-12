/**
 * The only file that touches the notification listener's native module (D17).
 *
 * Null on iOS and on any build made before the module existed, so everything
 * above this treats "detection is not available here" as an ordinary state:
 * the inbox and the paste box still work without it.
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import FinlyCapture, { type NativeCaptureStats } from '../../../modules/finly-capture';

import { ingest } from './ingest';

export type { NativeCaptureStats };

export const captureNative = Platform.OS === 'android' ? FinlyCapture : null;

export const isCaptureAvailable = captureNative !== null;

const PULL_SIZE = 200;
/** A queue is capped at 2,000 natively; this is enough rounds to empty it. */
const MAX_ROUNDS = 12;

let draining: Promise<number> | null = null;

/**
 * Moves what the listener queued into the inbox. Acknowledges each batch only
 * after it is written, so an interruption replays rather than loses — and the
 * write is idempotent, so a replay is harmless. Concurrent calls share one run.
 */
export function drainNativeQueue(): Promise<number> {
  const native = captureNative;
  if (native === null) return Promise.resolve(0);
  if (draining !== null) return draining;

  draining = (async () => {
    let total = 0;
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const batch = await native.pull(PULL_SIZE);
      if (batch.length === 0) break;
      await ingest(
        batch.map((capture) => ({
          source: 'notification' as const,
          packageName: capture.packageName,
          sender: capture.sender,
          title: capture.title,
          body: capture.body,
          postedAt: capture.postedAt,
          receivedAt: capture.postedAt,
        })),
      );
      await native.ack(batch.map((capture) => capture.id));
      total += batch.length;
      if (batch.length < PULL_SIZE) break;
    }
    return total;
  })().finally(() => {
    draining = null;
  });

  return draining;
}

export type ListenerState = {
  /** The module exists in this build, on this platform. */
  available: boolean;
  /** The user has granted notification access in system settings. */
  granted: boolean;
  /** The system has the service bound right now. */
  connected: boolean;
};

const readState = (): ListenerState => {
  const native = captureNative;
  if (native === null) return { available: false, granted: false, connected: false };
  try {
    return { available: true, granted: native.isGranted(), connected: native.isConnected() };
  } catch {
    return { available: true, granted: false, connected: false };
  }
};

/**
 * Notification access lives in system settings, outside the database, so it is
 * re-read whenever the app returns to the foreground — which is how it usually
 * changes: the user goes to settings and comes back.
 */
export function useListenerState() {
  const [state, setState] = useState<ListenerState>(readState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') setState(readState());
    });
    return () => subscription.remove();
  }, []);

  const refresh = useCallback(() => setState(readState()), []);
  return { state, refresh };
}

/** The listener's counters, for diagnostics. Undefined until read, null if unavailable. */
export function useNativeStats() {
  const [stats, setStats] = useState<NativeCaptureStats | null | undefined>(() =>
    captureNative === null ? null : undefined,
  );

  useEffect(() => {
    let isMounted = true;
    const read = () => {
      const native = captureNative;
      if (native === null) return;
      void native
        .stats()
        .then((next) => {
          if (isMounted) setStats(next);
        })
        .catch(() => {
          if (isMounted) setStats(null);
        });
    };

    read();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') read();
    });
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return stats;
}

export type AppChoice = { packageName: string; label: string; isCurated: boolean };

/**
 * The payment apps the settings screen can offer: the curated ones actually
 * installed, plus any the user added themselves, labelled. The curated list is
 * `PAYMENT_APPS`; the manifest's <queries> block is what lets Android say
 * whether each one is installed.
 */
export function useAppChoices(curated: Readonly<Record<string, { name: string }>>, chosen: readonly string[]) {
  const [choices, setChoices] = useState<AppChoice[] | undefined>(() => (captureNative === null ? [] : undefined));
  const chosenKey = chosen.join('|');

  useEffect(() => {
    let isMounted = true;
    const native = captureNative;
    if (native === null) return;
    const custom = chosenKey.length === 0 ? [] : chosenKey.split('|').filter((name) => curated[name] === undefined);

    void Promise.all([native.installedPackages(Object.keys(curated)), native.appLabels(custom)])
      .then(([installed, labels]) => {
        if (!isMounted) return;
        setChoices([
          ...installed.map((packageName) => ({ packageName, label: curated[packageName].name, isCurated: true })),
          ...custom.map((packageName) => ({ packageName, label: labels[packageName] ?? packageName, isCurated: false })),
        ]);
      })
      .catch(() => {
        if (isMounted) setChoices([]);
      });

    return () => {
      isMounted = false;
    };
  }, [curated, chosenKey]);

  return choices;
}
