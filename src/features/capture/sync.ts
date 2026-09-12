/**
 * The detection feature's long-running job (D17), mounted once in the root
 * layout: keep the native listener's settings in step with the database, and
 * keep the inbox in step with the listener.
 *
 * It runs on launch, whenever the app returns to the foreground, and whenever
 * the listener reports a capture while the app is open. Each run re-reads
 * candidates an older parser read, drains the native queue, asks the system to
 * rebind a listener it has dropped, replays what is on screen, and clears
 * message text past its retention.
 */

import { router, useRootNavigationState } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { Db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getFlag, getSetting } from '@/db/repositories/settings';

import { parsePackages } from './hooks';
import { ingestText, purgeExpired, reparseIfStale } from './ingest';
import { captureNative, drainNativeQueue } from './native';

type NativeSettings = { enabled: boolean; packages: string[]; notify: boolean };

const readNativeSettings = (database: Db): NativeSettings => ({
  enabled: getFlag('capture_enabled', database),
  packages: parsePackages(getSetting('capture_packages', database)),
  notify: getFlag('capture_notify_enabled', database),
});

let lastPurgeAt = 0;
const PURGE_EVERY_MS = 6 * 60 * 60 * 1000;

let running: Promise<void> | null = null;

/** One pass of upkeep. Never throws: a failed pass is retried by the next one. */
function maintain(): Promise<void> {
  if (running !== null) return running;
  running = (async () => {
    try {
      await reparseIfStale();
      await drainNativeQueue();

      const native = captureNative;
      if (native !== null && getFlag('capture_enabled') && native.isGranted()) {
        if (!native.isConnected()) native.requestRebind();
        await native.replayActive();
      }

      const now = Date.now();
      if (now - lastPurgeAt > PURGE_EVERY_MS) {
        purgeExpired(now);
        lastPurgeAt = now;
      }
    } catch {
      // Upkeep is best effort. The inbox shows what is stored either way.
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

export function useCaptureSync() {
  const settings = useDbQuery<NativeSettings>('capture:native-settings', ['settings'], readNativeSettings);

  /* Primitives, not the object: every write to the settings table produces a
     new one, and the listener only needs telling when one of these moves. */
  const enabled = settings.data?.enabled;
  const notify = settings.data?.notify;
  const packagesKey = settings.data?.packages.join('|');

  useEffect(() => {
    const native = captureNative;
    if (native === null || enabled === undefined || notify === undefined || packagesKey === undefined) return;
    try {
      native.setMonitoredPackages(packagesKey.length === 0 ? [] : packagesKey.split('|'));
      native.setNotifyEnabled(notify);
      native.setEnabled(enabled);
    } catch {
      // A native failure here leaves the previous settings in place.
    }
  }, [enabled, notify, packagesKey]);

  useEffect(() => {
    void maintain();
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void maintain();
    });
    const captures = captureNative?.addListener('onCapture', () => {
      void maintain();
    });
    return () => {
      appState.remove();
      captures?.remove();
    };
  }, []);
}

/**
 * Opens what another app shared to Finly — usually a payment SMS long-pressed
 * in the messages app — as a candidate, ready to confirm.
 *
 * Mounted inside AppLock, like the reminder's tap router: while locked it is
 * not mounted, and the shared text waits on the launch intent until unlock.
 */
export function useShareIntake() {
  const navigatorKey = useRootNavigationState()?.key;
  const [shared, setShared] = useState<{ id: number; text: string } | null>(null);
  const routed = useRef<number | null>(null);

  useEffect(() => {
    const native = captureNative;
    if (native === null) return;
    const take = () => {
      try {
        const text = native.consumeSharedText();
        if (text !== null) setShared({ id: Date.now(), text });
      } catch {
        // Nothing shared, or the activity is gone.
      }
    };
    /* After mount rather than during it: the launch intent is read once. */
    void Promise.resolve().then(take);
    const subscription = native.addListener('onSharedText', take);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') take();
    });
    return () => {
      subscription.remove();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    if (shared === null || navigatorKey === undefined) return;
    if (routed.current === shared.id) return;
    routed.current = shared.id;
    if (!getFlag('onboarding_done')) return;

    void ingestText(shared.text, 'share')
      .then((outcome) => {
        if (outcome !== null) router.push(`/inbox/${outcome.candidateId}`);
      })
      .catch(() => undefined);
  }, [shared, navigatorKey]);
}
