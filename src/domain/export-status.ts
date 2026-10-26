/**
 * What an export on the Import & export screen should do.
 *
 * §10 names device loss as the risk with no server behind it, so the app shows
 * a "last backed up" stamp and a warning when it goes stale. That stamp has to
 * mean something: only the JSON full backup can actually restore everything,
 * so it is the only one allowed to move it. A CSV is expenses only — it cannot
 * bring back accounts, rules, settlements or categories — so stamping "backed
 * up" after writing one is a false sense of safety.
 *
 * The share sheet on both platforms resolves the moment it closes, whether the
 * user picked a target or just tapped away; the app cannot tell the two apart.
 * So the wording never claims the export completed — it says the file is ready
 * to share — and the timestamp is only recorded when a share app was available
 * (when the file genuinely left the device).
 */

export type ExportKind = 'json' | 'csv';

/** The outcome the data-transfer file layer reports back to the screen. */
export type ShareOutcome = { uri: string; shared: boolean };

export type ExportDecision = {
  /** Whether this export moves the "last backed up" stamp. */
  recordTimestamp: boolean;
  /** The one line the screen shows afterwards. */
  notice: string;
};

export function decideExport(kind: ExportKind, outcome: ShareOutcome): ExportDecision {
  const noun = kind === 'json' ? 'Backup' : 'Expenses';

  if (outcome.shared) {
    // The sheet was available and the file was handed to it. We cannot see
    // which target the user picked, so the line says "ready to share" rather
    // than claiming a specific app took it.
    return {
      recordTimestamp: kind === 'json',
      notice: `${noun} ready to share.`,
    };
  }

  // No share app: the file sits in the app's cache, not in the user's hands.
  // Nothing left the device, so nothing is backed up and we say so.
  return {
    recordTimestamp: false,
    notice: `No share app was available. ${noun} saved to ${outcome.uri}`,
  };
}
