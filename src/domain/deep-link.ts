/**
 * Links into the app, built from the scheme the running build declares.
 *
 * The development build is a separate app with its own scheme (app.config.ts),
 * so a link written as `finly://…` would open the production app from it.
 */

/** The production scheme: what a build that declares none has always used. */
const FALLBACK_SCHEME = 'finly';

/** The first scheme the app declares; Expo allows one or several. */
export function pickScheme(raw: string | readonly string[] | null | undefined): string {
  const first = typeof raw === 'string' ? raw : raw?.[0];
  return first ? first : FALLBACK_SCHEME;
}

export const deepLink = (scheme: string, path: string): string => `${scheme}://${path}`;
