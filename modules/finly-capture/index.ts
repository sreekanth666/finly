/**
 * The JavaScript face of the Android notification listener (D17).
 *
 * `null` wherever the native module is absent — iOS, and any build made before
 * the module was added — so every caller has to handle "detection is not
 * available here" rather than crash. Feature code reaches this only through
 * src/features/capture/native.ts.
 */

import { NativeModule, requireOptionalNativeModule } from 'expo';

export type NativeCapture = {
  id: number;
  packageName: string;
  sender: string | null;
  title: string | null;
  body: string;
  postedAt: number;
};

export type NativeCaptureStats = {
  queued: number;
  rejected: number;
  redacted: number;
  unreadable: number;
  errors: number;
  lastCaptureAt: number;
  lastConnectedAt: number;
};

type FinlyCaptureEvents = {
  onCapture(event: { count: number }): void;
  onSharedText(event: { available: boolean }): void;
};

declare class FinlyCaptureNativeModule extends NativeModule<FinlyCaptureEvents> {
  isGranted(): boolean;
  isConnected(): boolean;
  getDefaultSmsPackage(): string | null;
  setEnabled(enabled: boolean): void;
  setMonitoredPackages(packages: string[]): void;
  setNotifyEnabled(enabled: boolean): void;
  openListenerSettings(): void;
  requestRebind(): void;
  replayActive(): Promise<boolean>;
  pull(limit: number): Promise<NativeCapture[]>;
  ack(ids: number[]): Promise<void>;
  stats(): Promise<NativeCaptureStats>;
  installedPackages(candidates: string[]): Promise<string[]>;
  appLabels(packages: string[]): Promise<Record<string, string>>;
  listActivePackages(): Promise<{ packageName: string; label: string }[]>;
  /** Text shared to Finly from another app, once; null when there is none. */
  consumeSharedText(): string | null;
}

export default requireOptionalNativeModule<FinlyCaptureNativeModule>('FinlyCapture');
