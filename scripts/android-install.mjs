#!/usr/bin/env node
/**
 * Installs the newest dev APK from builds/dev onto an attached device.
 *
 * Install only — no Gradle, no Metro. The dev build is a shell that loads JS
 * from the dev server, so the usual loop is: install once, then `pnpm start`
 * for the rest of the day.
 *
 * Run: pnpm install:dev
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APK_DIR = join(ROOT, 'builds/dev');

function fail(message, hint) {
  console.error(message);
  if (hint) console.error(`  → ${hint}`);
  process.exit(1);
}

/** platform-tools is often outside PATH even when the SDK is installed. */
function resolveAdb() {
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const bundled = sdkRoot && join(sdkRoot, 'platform-tools/adb');
  if (bundled && existsSync(bundled)) return bundled;
  if (!spawnSync('adb', ['version'], { stdio: 'ignore' }).error) return 'adb';
  return null;
}

const adb = resolveAdb();
if (!adb) {
  fail('No adb found.', 'install the SDK platform-tools and export ANDROID_HOME');
}

if (!existsSync(APK_DIR)) {
  fail('No builds/dev directory yet.', 'run pnpm build:dev first');
}

const apks = readdirSync(APK_DIR)
  .filter((entry) => entry.endsWith('.apk'))
  .map((entry) => ({ entry, mtime: statSync(join(APK_DIR, entry)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (apks.length === 0) {
  fail('No APK in builds/dev.', 'run pnpm build:dev first');
}

const devices = spawnSync(adb, ['devices'], { encoding: 'utf8' })
  .stdout.split('\n')
  .slice(1)
  .map((line) => line.trim().split(/\s+/))
  .filter(([serial, state]) => serial && state === 'device')
  .map(([serial]) => serial);

if (devices.length === 0) {
  fail('No device or emulator attached.', 'start an emulator, or plug in a phone with USB debugging on');
}

/**
 * adb's own "more than one device" error does not say which, and the fix is
 * not obvious from it.
 */
if (devices.length > 1 && !process.env.ANDROID_SERIAL) {
  fail(
    `More than one device attached: ${devices.join(', ')}.`,
    'pick one with ANDROID_SERIAL=<serial> pnpm install:dev',
  );
}

const target = process.env.ANDROID_SERIAL ?? devices[0];
const apk = apks[0].entry;

console.log(`Installing builds/dev/${apk} to ${target}.\n`);

const result = spawnSync(adb, ['-s', target, 'install', '-r', join(APK_DIR, apk)], {
  stdio: 'inherit',
});
if (result.status !== 0) {
  fail('\nInstall failed.', 'if the signature changed, uninstall the old build first');
}

console.log('\nInstalled. Run pnpm start, then open the app.');
