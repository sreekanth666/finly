/**
 * The model's doubt, adjusted by what this user has said about this sender
 * (D21).
 *
 * The user's own labels for a sender — payments confirmed, messages marked
 * not a payment — pull the model's probability toward their own record:
 *
 *     p = (notPayment + α·p_model) / (confirmed + notPayment + α)
 *
 * With no labels it is the model's answer exactly, so there is no jump when
 * the first label lands; α labels weigh as much as the model does. Discarding
 * is never a label (see `labelled.ts`).
 */

import type { Model } from './weights-format';

export type LabelCounts = { confirmed: number; notTransaction: number };

export function personalised(pModel: number, counts: LabelCounts | undefined, alpha: number): number {
  if (counts === undefined) return pModel;
  const confirmed = Math.max(0, counts.confirmed);
  const notTransaction = Math.max(0, counts.notTransaction);
  return (notTransaction + alpha * pModel) / (confirmed + notTransaction + alpha);
}

/** Whether this user's adjusted score crosses the model's threshold. A model with none doubts nothing. */
export const isDoubtful = (score: number, counts: LabelCounts | undefined, model: Pick<Model, 'alpha' | 'threshold'>): boolean =>
  model.threshold.doubt !== null && personalised(score, counts, model.alpha) >= model.threshold.doubt;

/**
 * The counts after one label is given or taken back: never below zero, and a
 * sender the user asked Finly to forget (`current` null) starts from nothing.
 */
export function nextCounts(current: LabelCounts | null, field: keyof LabelCounts, delta: 1 | -1): LabelCounts {
  const base = current ?? { confirmed: 0, notTransaction: 0 };
  return { ...base, [field]: Math.max(0, base[field] + delta) };
}

/** What the inbox needs to apply the model (D21), read once per pass. */
export type ModelContext = {
  /** The user's switch. Off, the model only scores, in shadow. */
  enabled: boolean;
  counts: ReadonlyMap<string, LabelCounts>;
  model: Pick<Model, 'alpha' | 'threshold'> | null;
};

/** Whether the model, adjusted by this user's labels, doubts a stored candidate. */
export function modelDoubts(candidate: { modelScore: number | null; modelKey: string | null }, context: ModelContext): boolean {
  if (!context.enabled || context.model === null || candidate.modelScore === null) return false;
  const counts = candidate.modelKey === null ? undefined : context.counts.get(candidate.modelKey);
  return isDoubtful(candidate.modelScore, counts, context.model);
}
