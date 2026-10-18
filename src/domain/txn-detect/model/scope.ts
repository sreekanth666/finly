/**
 * What the detector's model is asked about, and under which key a user's
 * labels count (D21). Apart from `assess.ts` so the trainer, which writes the
 * shipped model, never has to load it.
 */

import { skeletonOf } from '@/domain/support/skeleton';

import { isDltSenderId, isSmsApp, senderHeader, senderSuffix } from '../sources';
import type { Detection, MessageInput } from '../types';
import type { ModelInput } from './features';

/**
 * Only a debit the rules called a transaction: the model may doubt a payment,
 * never invent one, and never reconsider what a gate filed or a taught format
 * (D18) read — the user's own format has the last word.
 */
export const isAssessable = (detection: Pick<Detection, 'kind' | 'direction' | 'reasons'>): boolean =>
  detection.kind === 'transaction' &&
  detection.direction !== 'credit' &&
  !detection.reasons.some((reason) => reason.startsWith('template:'));

/**
 * Who a user's labels are counted under: the DLT header with its suffix, so a
 * bank's promotions never count against its alerts; else the app; else
 * nothing, and the model's score stands alone.
 */
export function labelKeyOf(input: Pick<MessageInput, 'sender' | 'title' | 'packageName'>): string | null {
  const id = isDltSenderId(input.sender) ? input.sender : isDltSenderId(input.title) ? input.title : null;
  const header = senderHeader(id);
  if (header !== null) {
    const suffix = senderSuffix(id);
    return suffix === null ? header : `${header}-${suffix}`;
  }
  if (input.packageName != null && !isSmsApp(input.packageName)) return input.packageName;
  return null;
}

/** The skeleton of the message as it was stored — the form every training row was made from. */
export const modelInputOf = (input: MessageInput): ModelInput => ({
  skeleton: skeletonOf(input.body),
  sender: input.sender ?? null,
  title: input.title ?? null,
  packageName: input.packageName ?? null,
});
