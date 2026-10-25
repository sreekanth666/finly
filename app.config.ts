/**
 * app.json is the production app. This file lays the development variant over
 * it so both can be installed on one phone: Android and iOS key an app by its
 * ID, so a debug build under the release ID replaces it (or is refused, when
 * the signing keys differ) and shares its storage.
 *
 * APP_VARIANT picks the variant; unset is production. Anything else throws —
 * a typo must not quietly build the production identity.
 *
 * The slug stays `finly` in both: it is tied to the EAS project.
 *
 * Changing the variant changes the native project, so switch with
 * `pnpm native:dev` / `pnpm native:prod`. `pnpm start` sets it itself.
 */

import type { ConfigContext, ExpoConfig } from 'expo/config';

export type AppVariant = 'development' | 'production';

const VARIANTS: Record<AppVariant, { name: string; id: string; scheme: string }> = {
  development: { name: 'Finly Dev', id: 'com.thecstudio.finly.dev', scheme: 'finly-dev' },
  production: { name: 'Finly', id: 'com.thecstudio.finly', scheme: 'finly' },
};

/**
 * The dev build packages its native stack (Hermes, React Native, Reanimated,
 * SQLCipher, Skia) once per ABI, and the template's four made a ~297 MB APK.
 * Phones are arm64; x86 is emulator-only and armeabi-v7a is old 32-bit
 * hardware. Release keeps every ABI: Play serves each device only its own.
 */
const DEV_BUILD_ARCHS = ['arm64-v8a'];

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

/** Merges into the existing entry so the plugin runs once with app.json's R8 options intact. */
function withDevBuildArchs(plugins: PluginEntry[]): PluginEntry[] {
  return plugins.map((entry) => {
    if (!Array.isArray(entry) || entry[0] !== 'expo-build-properties') return entry;
    const options = (entry[1] ?? {}) as { android?: Record<string, unknown> };
    return ['expo-build-properties', { ...options, android: { ...options.android, buildArchs: DEV_BUILD_ARCHS } }];
  });
}

export function resolveVariant(raw: string | undefined): AppVariant {
  if (raw === undefined || raw === '') return 'production';
  if (raw === 'development' || raw === 'production') return raw;
  throw new Error(`APP_VARIANT must be "development" or "production", got "${raw}".`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = resolveVariant(process.env.APP_VARIANT);
  const { name, id, scheme } = VARIANTS[variant];
  const plugins = config.plugins ?? [];

  return {
    ...config,
    name,
    slug: config.slug ?? 'finly',
    scheme,
    ios: { ...config.ios, bundleIdentifier: id },
    android: { ...config.android, package: id },
    plugins: [
      ...(variant === 'development' ? withDevBuildArchs(plugins) : plugins),
      /* Without this the generated `exp+finly` scheme ships in both apps and the
         phone asks which one a dev-server link should open. */
      ['expo-dev-client', { addGeneratedScheme: variant === 'development' }],
    ],
  };
};
