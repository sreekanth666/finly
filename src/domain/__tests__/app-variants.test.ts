/**
 * The development variant: a second installable Finly with its own identity, so
 * a debug build never collides with the release one on the same phone.
 *
 * app.config.ts is read from the repo root, like fixtures/capture-gate.ts reads
 * the Kotlin gate: the config is the thing the phone ships.
 */

import { expo as base } from '../../../app.json';
import pkg from '../../../package.json';
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

const entriesNamed = (name: string) => (plugins: readonly PluginEntry[] | undefined) =>
  (plugins ?? []).filter((entry) => (Array.isArray(entry) ? entry[0] : entry) === name);

const devClientEntries = entriesNamed('expo-dev-client');
const buildPropertiesEntries = entriesNamed('expo-build-properties');

const basePlugins = base.plugins as PluginEntry[];

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

  it('builds every ABI, as app.json declares, so the Play listing covers every device', () => {
    const entries = buildPropertiesEntries(config.plugins as PluginEntry[]);
    expect(entries).toEqual(buildPropertiesEntries(basePlugins));
    expect(entries).toHaveLength(1);
    expect((entries[0] as [string, { android: Record<string, unknown> }])[1].android.buildArchs).toBeUndefined();
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

  it('builds arm64 only, once, keeping the release shrinking options', () => {
    const [entry, ...rest] = buildPropertiesEntries(config.plugins as PluginEntry[]);
    expect(rest).toEqual([]);
    expect(entry).toEqual([
      'expo-build-properties',
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          buildArchs: ['arm64-v8a'],
        },
      },
    ]);
  });

  it('changes nothing else the production app declares', () => {
    expect(config.android?.permissions).toEqual(base.android.permissions);
    expect(config.android?.adaptiveIcon).toEqual(base.android.adaptiveIcon);
    const others = (plugins: readonly PluginEntry[] | undefined) =>
      (plugins ?? []).filter((entry) => {
        const name = Array.isArray(entry) ? entry[0] : entry;
        return name !== 'expo-dev-client' && name !== 'expo-build-properties';
      });
    expect(others(config.plugins as PluginEntry[])).toEqual(others(basePlugins));
  });
});

/**
 * Every command that starts or generates the app names its variant. One that
 * does not builds the production ID as a debug app — the collision the variants
 * exist to prevent — or serves a manifest whose scheme the binary does not own.
 */
describe('package scripts', () => {
  const { scripts } = pkg as { scripts: Record<string, string> };

  it.each(['start', 'android', 'ios', 'native:dev'])('%s runs as the development variant', (name) => {
    expect(scripts[name]).toMatch(/^APP_VARIANT=development /);
  });

  it('native:prod pins production, so an exported dev variant cannot leak into it', () => {
    expect(scripts['native:prod']).toMatch(/^APP_VARIANT=production /);
  });
});
