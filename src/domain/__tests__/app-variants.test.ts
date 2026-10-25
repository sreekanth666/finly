/**
 * The development variant: a second installable Finly with its own identity, so
 * a debug build never collides with the release one on the same phone.
 *
 * app.config.ts is read from the repo root, like fixtures/capture-gate.ts reads
 * the Kotlin gate: the config is the thing the phone ships.
 */

import { expo as base } from '../../../app.json';
import appConfig, { resolveVariant } from '../../../app.config';

type PluginEntry = string | [string, Record<string, unknown>];

const resolve = (variant: string | undefined) => {
  const before = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try {
    return appConfig({ config: base as never, projectRoot: '.', staticConfigPath: null, packageJsonPath: null });
  } finally {
    if (before === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = before;
  }
};

const devClientEntries = (plugins: readonly PluginEntry[] | undefined) =>
  (plugins ?? []).filter((entry) => (Array.isArray(entry) ? entry[0] : entry) === 'expo-dev-client');

describe('resolveVariant', () => {
  it('reads an unset variant as production', () => {
    expect(resolveVariant(undefined)).toBe('production');
  });

  it('accepts the two named variants', () => {
    expect(resolveVariant('production')).toBe('production');
    expect(resolveVariant('development')).toBe('development');
  });

  it('refuses a mistyped variant instead of building the production identity', () => {
    expect(() => resolveVariant('develpoment')).toThrow(/develpoment/);
  });
});

describe('production variant', () => {
  const config = resolve(undefined);

  it('keeps the identity the store build already has', () => {
    expect(config.name).toBe('Finly');
    expect(config.slug).toBe('finly');
    expect(config.scheme).toBe('finly');
    expect(config.android?.package).toBe('com.thecstudio.finly');
    expect(config.ios?.bundleIdentifier).toBe('com.thecstudio.finly');
  });

  it('leaves the generated dev-client scheme out of the release build, once', () => {
    expect(devClientEntries(config.plugins as PluginEntry[])).toEqual([['expo-dev-client', { addGeneratedScheme: false }]]);
  });
});

describe('development variant', () => {
  const config = resolve('development');

  it('is a separate app: own name, own ID, own scheme', () => {
    expect(config.name).toBe('Finly Dev');
    expect(config.scheme).toBe('finly-dev');
    expect(config.android?.package).toBe('com.thecstudio.finly.dev');
    expect(config.ios?.bundleIdentifier).toBe('com.thecstudio.finly.dev');
  });

  it('keeps the slug, which is tied to the EAS project', () => {
    expect(config.slug).toBe('finly');
  });

  it('keeps the dev-client scheme, once, so dev-server QR codes open this build', () => {
    expect(devClientEntries(config.plugins as PluginEntry[])).toEqual([['expo-dev-client', { addGeneratedScheme: true }]]);
  });

  it('changes nothing else the production app declares', () => {
    expect(config.android?.permissions).toEqual(base.android.permissions);
    expect(config.android?.adaptiveIcon).toEqual(base.android.adaptiveIcon);
    const others = (plugins: readonly PluginEntry[] | undefined) =>
      (plugins ?? []).filter((entry) => (Array.isArray(entry) ? entry[0] : entry) !== 'expo-dev-client');
    expect(others(config.plugins as PluginEntry[])).toEqual(others(base.plugins as PluginEntry[]));
  });
});
