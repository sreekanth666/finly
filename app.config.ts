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

export function resolveVariant(raw: string | undefined): AppVariant {
  if (raw === undefined || raw === '') return 'production';
  if (raw === 'development' || raw === 'production') return raw;
  throw new Error(`APP_VARIANT must be "development" or "production", got "${raw}".`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = resolveVariant(process.env.APP_VARIANT);
  const { name, id, scheme } = VARIANTS[variant];

  return {
    ...config,
    name,
    slug: config.slug ?? 'finly',
    scheme,
    ios: { ...config.ios, bundleIdentifier: id },
    android: { ...config.android, package: id },
    plugins: [
      ...(config.plugins ?? []),
      /* Without this the generated `exp+finly` scheme ships in both apps and the
         phone asks which one a dev-server link should open. */
      ['expo-dev-client', { addGeneratedScheme: variant === 'development' }],
    ],
  };
};
