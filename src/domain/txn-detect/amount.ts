/**
 * Which figure in a message is the amount.
 *
 * Most alerts carry more than one: the payment, then the balance or the card's
 * available limit. A statement carries two by design. So every figure is
 * scored rather than the first one taken:
 *
 * - beside a money verb ("debited for", "spent", "INR 350 debited") scores up;
 * - just after a balance-ish word ("Avl Bal", "limit", "TAD", "cashback") scores
 *   well down;
 * - a currency mark scores a little, and so does coming first.
 *
 * The figure is isolated before `parseMinor` sees it. `parseMinor` strips every
 * letter it is given, so handed "720.00 on 02-Sep-26" it would happily return
 * 720.000226 — it must only ever see the number itself.
 *
 * SBI's UPI alerts carry no currency mark at all ("debited by 1000.00"), so a
 * bare figure with paise directly after a debit or credit verb also counts.
 */

import { parseMinor, type Minor } from '@/domain/money';

import { findVerbs, type VerbHit } from './vocabulary';

export type AmountFinding = {
  amountMinor: Minor;
  currency: string;
  index: number;
  end: number;
  score: number;
  marked: boolean;
};

export type AmountReading = {
  best: AmountFinding | null;
  candidates: Minor[];
  /** A different figure scored within a point of the winner. */
  ambiguous: boolean;
};

const MARKED = /\b(INR|USD|EUR|GBP|AED|SGD|AUD|CAD) ([0-9][0-9,]*(?:\.[0-9]+)?)/g;
const BARE_AFTER_VERB =
  /\b(?:debited|credited|debit|credit|paid|spent|withdrawn|sent|received)\s+(?:by|for|with|of)?\s*([0-9][0-9,]*\.[0-9]{2})\b/gi;

/** The words that, just before a figure, mean it is not the payment. */
const NOT_THE_PAYMENT =
  /\b(?:bal|balance|avl|avail|avlbl|available|limit|lmt|due|tad|mad|outstanding|cashback|upto|min|minimum|total|reward|fee|charges?|updated|closing|opening|save|off)\b/i;

const MAX_CANDIDATES = 4;

function scoreFinding(text: string, index: number, end: number, verbs: readonly VerbHit[]): number {
  let score = 0;

  const before = text.slice(Math.max(0, index - 30), index).split(/\s+/).slice(-3).join(' ');
  if (NOT_THE_PAYMENT.test(before)) score -= 6;

  const near = verbs.some((verb) => verb.end >= index - 45 && verb.index <= end + 30);
  const beside = verbs.some((verb) => verb.end >= index - 18 && verb.index <= end + 14);
  if (near) score += 3;
  if (beside) score += 2;

  return score;
}

const cleanToken = (token: string) => token.replace(/,+$/, '');

export function readAmounts(text: string): AmountReading {
  const verbs = findVerbs(text);
  const findings: AmountFinding[] = [];

  for (const match of text.matchAll(MARKED)) {
    const amountMinor = parseMinor(cleanToken(match[2]));
    if (amountMinor === null || amountMinor <= 0) continue;
    const index = match.index;
    const end = index + match[0].length;
    findings.push({
      amountMinor,
      currency: match[1],
      index,
      end,
      score: scoreFinding(text, index, end, verbs) + 1,
      marked: true,
    });
  }

  for (const match of text.matchAll(BARE_AFTER_VERB)) {
    const index = match.index + match[0].length - match[1].length;
    const end = index + match[1].length;
    if (findings.some((finding) => index < finding.end && end > finding.index)) continue;
    const amountMinor = parseMinor(match[1]);
    if (amountMinor === null || amountMinor <= 0) continue;
    findings.push({
      amountMinor,
      currency: 'INR',
      index,
      end,
      score: scoreFinding(text, index, end, verbs),
      marked: false,
    });
  }

  if (findings.length === 0) return { best: null, candidates: [], ambiguous: false };

  const first = Math.min(...findings.map((finding) => finding.index));
  for (const finding of findings) {
    if (finding.index === first) finding.score += 1;
  }

  const ranked = [...findings].sort((a, b) => b.score - a.score || a.index - b.index);
  const best = ranked[0];

  const candidates: Minor[] = [];
  for (const finding of ranked) {
    if (!candidates.includes(finding.amountMinor)) candidates.push(finding.amountMinor);
  }

  const ambiguous = ranked.some(
    (finding) => finding.amountMinor !== best.amountMinor && finding.score >= best.score - 1,
  );

  return { best, candidates: candidates.slice(0, MAX_CANDIDATES), ambiguous };
}
