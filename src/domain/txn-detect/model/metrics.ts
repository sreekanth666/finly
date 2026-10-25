/**
 * How well a reading of the corpus did, in the numbers that matter to the
 * inbox (D21).
 *
 * Accuracy alone would hide the failure users report: real payments vastly
 * outnumber everything else, so a reader that calls every message a payment
 * scores well and fills Needs review with offers. What is measured instead:
 *
 * - **lost**: money that moved and was read as something else. The one number
 *   that must not grow, whatever else improves.
 * - **review precision**: of what lands in Needs review, how much is spending.
 * - **false positives**: messages that must not count, sitting in the badge
 *   (Needs review or Maybe) anyway.
 * - **demoted**: real spending moved from Needs review to Maybe — still
 *   counted, still confirmable, but a cost; any model is held to a budget of it.
 *
 * Ambiguous rows are counted and set aside.
 */

import { MOVED_KINDS } from '../classify';
import type { InboxSection } from '../inbox';
import type { DetectionKind } from '../types';
import type { CorpusGroup } from './corpus';

/** Where one reading put a message. */
export type Placement = { kind: DetectionKind; section: InboxSection };

export type Scored = {
  id: string;
  senderKey: string;
  /** The person's verdict. */
  truth: DetectionKind;
  group: CorpusGroup;
  placed: Placement;
  /** Where the rules alone put it, when this reading is something more than the rules. */
  baseline?: Placement;
};

export type SenderMetrics = { rows: number; lost: number; falsePositives: number };

export type Metrics = {
  rows: number;
  ambiguous: number;
  mustCapture: number;
  lost: string[];
  spending: number;
  /** Spending still read as a transaction, wherever it was filed. */
  spendingKept: number;
  inReview: number;
  reviewSpending: number;
  /** Of what Needs review holds, how much is spending; 1 when it holds nothing. */
  reviewPrecision: number;
  mustNotCount: number;
  falsePositives: string[];
  /** False positives over everything that must not count; 0 when there is none. */
  falsePositiveRate: number;
  demoted: string[];
  bySender: Record<string, SenderMetrics>;
};

const IN_BADGE: readonly InboxSection[] = ['review', 'maybe'];

const ratio = (part: number, whole: number, empty: number): number => (whole === 0 ? empty : part / whole);

export function evaluate(items: readonly Scored[]): Metrics {
  const lost: string[] = [];
  const falsePositives: string[] = [];
  const demoted: string[] = [];
  const bySender: Record<string, SenderMetrics> = {};
  let ambiguous = 0;
  let mustCapture = 0;
  let mustNotCount = 0;
  let spending = 0;
  let spendingKept = 0;
  let inReview = 0;
  let reviewSpending = 0;

  for (const item of items) {
    const sender = (bySender[item.senderKey] ??= { rows: 0, lost: 0, falsePositives: 0 });
    sender.rows += 1;
    if (item.group === 'ambiguous') {
      ambiguous += 1;
      continue;
    }

    const isSpending = item.truth === 'transaction';
    if (item.placed.section === 'review') {
      inReview += 1;
      if (isSpending) reviewSpending += 1;
    }
    if (isSpending) {
      spending += 1;
      if (item.placed.kind === 'transaction') spendingKept += 1;
      if (item.baseline?.section === 'review' && item.placed.section === 'maybe') demoted.push(item.id);
    }

    if (item.group === 'must_capture') {
      mustCapture += 1;
      if (!MOVED_KINDS.includes(item.placed.kind)) {
        lost.push(item.id);
        sender.lost += 1;
      }
    } else {
      mustNotCount += 1;
      if (IN_BADGE.includes(item.placed.section)) {
        falsePositives.push(item.id);
        sender.falsePositives += 1;
      }
    }
  }

  return {
    rows: items.length,
    ambiguous,
    mustCapture,
    lost,
    spending,
    spendingKept,
    inReview,
    reviewSpending,
    reviewPrecision: ratio(reviewSpending, inReview, 1),
    mustNotCount,
    falsePositives,
    falsePositiveRate: ratio(falsePositives.length, mustNotCount, 0),
    demoted,
    bySender,
  };
}

const percent = (value: number): string => `${Math.round(value * 1000) / 10}%`;

/** At most ten ids, so a dataset of thousands still prints a readable line. */
const someOf = (ids: readonly string[]): string =>
  ids.length <= 10 ? ids.join(', ') : `${ids.slice(0, 10).join(', ')} and ${ids.length - 10} more`;

/** The numbers a PR records, as plain lines. */
export function describeMetrics(label: string, metrics: Metrics): string {
  const worst = Object.entries(metrics.bySender)
    .filter(([, sender]) => sender.lost + sender.falsePositives > 0)
    .sort(([, a], [, b]) => b.lost + b.falsePositives - (a.lost + a.falsePositives))
    .slice(0, 8)
    .map(([key, sender]) => `    ${key}: ${sender.lost} lost, ${sender.falsePositives} false positive(s) of ${sender.rows}`);
  return [
    `${label}: ${metrics.rows} rows (${metrics.ambiguous} ambiguous, set aside)`,
    `  lost: ${metrics.lost.length} of ${metrics.mustCapture} that moved money${metrics.lost.length > 0 ? ` — ${someOf(metrics.lost)}` : ''}`,
    `  review precision: ${percent(metrics.reviewPrecision)} (${metrics.reviewSpending} of ${metrics.inReview} in Needs review are spending)`,
    `  spending kept: ${metrics.spendingKept} of ${metrics.spending}`,
    `  false positives: ${metrics.falsePositives.length} of ${metrics.mustNotCount} (${percent(metrics.falsePositiveRate)})${metrics.falsePositives.length > 0 ? ` — ${someOf(metrics.falsePositives)}` : ''}`,
    `  demoted: ${metrics.demoted.length}`,
    ...(worst.length > 0 ? ['  by sender:', ...worst] : []),
  ].join('\n');
}
