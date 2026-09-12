/**
 * The identity of a captured message, for the unique index that makes
 * ingesting idempotent.
 *
 * The notification listener delivers at least once — a conversation is
 * re-posted with every new message, the service replays what is on screen each
 * time it reconnects, and a drain can be interrupted before its acknowledgement
 * lands. The key is the sending app, the sender, the normalised text and, for a
 * notification, the minute it was posted. The minute is what keeps two
 * genuinely identical alerts a few minutes apart from being merged.
 *
 * A small pure hash rather than SHA-256 through expo-crypto: this has to run
 * inside a synchronous write transaction and inside the Node tests, and it only
 * has to separate one person's messages from each other, not resist an attacker.
 */

import { normaliseText } from './normalise';

export type CaptureSource = 'notification' | 'paste' | 'share';

/** cyrb53: 53 bits, so a collision among a lifetime of alerts is not a concern. */
function hash53(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** The body as the duplicate check compares it: normalised, case folded. */
export const bodyKeyOf = (body: string): string => normaliseText(body).toLowerCase();

export function captureKey(input: {
  source: CaptureSource;
  packageName: string | null;
  sender: string | null;
  title: string | null;
  body: string;
  postedAt: number;
}): string {
  const origin = input.source === 'notification' ? (input.packageName ?? '') : input.source;
  const who = input.sender ?? input.title ?? '';
  const minute = input.source === 'notification' ? String(Math.floor(input.postedAt / 60_000)) : '';
  return `k1:${hash53([origin, who, bodyKeyOf(input.body), minute].join('|'))}`;
}
