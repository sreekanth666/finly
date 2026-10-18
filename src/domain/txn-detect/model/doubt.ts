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
