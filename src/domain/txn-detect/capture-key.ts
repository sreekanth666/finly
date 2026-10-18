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
 * The hash is `hash53`: 53 bits, so a collision among a lifetime of alerts is
 * not a concern.
 */

import { hash53 } from './hash';
import { normaliseText } from './normalise';

export type CaptureSource = 'notification' | 'paste' | 'share';

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
