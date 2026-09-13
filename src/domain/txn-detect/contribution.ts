/**
 * Sending a taught format, or a misread message, to the developer (D18).
 *
 * Nothing here sends anything. It builds the text of an email the user reads,
 * edits and sends themselves from their own mail app — Finly still has no
 * network code. The message is masked before it gets here, and the template
 * is the compact encoding, so a whole contribution fits in a mailto link.
 */

import { senderHeader } from './sources';
import { encodeSegments, type TemplateSpec } from './user-templates';

export const DEVELOPER_EMAIL = 'srekthk1@gmail.com';

/**
 * Longest mailto link to hand to a mail app. Android passes far longer, but
 * Gmail has a history of silently truncating long mailto bodies, and a
 * template cut in half is worse than none — past this, the Share sheet carries
 * the text instead.
 */
export const MAILTO_LIMIT = 1800;

const OUTCOME_WORDS: Record<TemplateSpec['outcome'], string> = {
  transaction: 'payment',
  transfer: 'transfer',
  ignore: 'not a payment (muted)',
};

/** The template as one line of JSON the developer can paste into the corpus. */
export function templatePayload(template: TemplateSpec, parserVersion: number): string {
  return JSON.stringify({
    v: 1,
    parser: parserVersion,
    binding: template.binding,
    outcome: template.outcome,
    direction: template.direction,
    gate: template.overridesGate,
    segments: encodeSegments(template.segments),
  });
}

/**
 * Who a contribution is about, for the subject line. Only a sender id or a
 * bank's name: a notification's sender can be a saved contact ("Mom"), or a
 * person's phone number, and the subject is the one line the user may not
 * read before sending.
 */
export function contributionSubject(
  template: TemplateSpec | null,
  sender: string | null,
  issuer: string | null = null,
): string {
  const who =
    senderHeader(sender) ?? template?.binding.senderKey ?? template?.binding.issuer ?? issuer ?? 'a bank';
  return template === null ? `Finly misread a message from ${who}` : `Finly message format: ${who}`;
}

/** What Finly made of a message, for a plain misread report. No amounts; the payee only masked. */
export type ReadingSummary = {
  kind: string;
  direction: string | null;
  confidence: string;
  dateConfidence: string;
  reasons: readonly string[];
  maskedPayee: string | null;
  sourceApp: string;
  senderKey: string | null;
};

export function contributionBody(input: {
  maskedMessage: string;
  template: TemplateSpec | null;
  appVersion: string | null;
  parserVersion: number;
  reading?: ReadingSummary | null;
}): string {
  const { template } = input;
  const lines = [
    template === null
      ? 'Finly did not read this message correctly.'
      : 'I taught Finly this message format. Please consider including it in an update.',
    '',
  ];

  if (template !== null) {
    const who = [template.binding.senderKey, template.binding.issuer, template.binding.packageName]
      .filter((part): part is string => part !== null)
      .join(' · ');
    lines.push(`Sender: ${who}`);
    const direction = template.direction === null ? '' : template.direction === 'debit' ? 'money out, ' : 'money in, ';
    lines.push(`What it is: ${direction}${OUTCOME_WORDS[template.outcome]}`);
  }
  lines.push(`App ${input.appVersion ?? 'unknown'} · reader ${input.parserVersion}`, '');

  const reading = input.reading ?? null;
  if (template === null && reading !== null) {
    lines.push(
      'What Finly read:',
      `  ${reading.kind}${reading.direction === null ? '' : `, ${reading.direction}`}, ${reading.confidence} confidence, date ${reading.dateConfidence}`,
      `  Payee: ${reading.maskedPayee ?? 'none found'}`,
      `  From: ${[reading.senderKey, reading.sourceApp].filter((part): part is string => part !== null).join(' · ')}`,
      `  Reasons: ${reading.reasons.join(', ') || 'none'}`,
      '',
    );
  }

  lines.push('Message (numbers, card digits and UPI ids scrambled):', input.maskedMessage.trim());

  if (template !== null) {
    lines.push('', 'Template:', templatePayload(template, input.parserVersion));
  }
  return lines.join('\n');
}

/**
 * A mailto link for the text, or null when it would be too long to trust a
 * mail app with — the caller shares it instead. Line breaks are CRLF, which
 * is what mail clients expect inside a mailto body.
 */
export function mailtoUrl(subject: string, body: string, to: string = DEVELOPER_EMAIL): string | null {
  const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`;
  return url.length <= MAILTO_LIMIT ? url : null;
}
