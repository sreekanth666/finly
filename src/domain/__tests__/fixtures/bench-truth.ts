/**
 * Reading an outside SMS dataset for `pnpm detector:bench` (D21), and saying
 * what each message truly is — written apart from the detector, so the
 * benchmark does not grade the reader against itself.
 *
 * Three shapes are understood, by their header:
 *
 * 1. `body,kind[,sender,packageName]` — our own: `kind` is the truth, one of
 *    the detector's kinds, and the group follows from it (`groupOf`).
 * 2. `message,category` — promotional or service, as several Indian SMS
 *    datasets are labelled. That label does not say whether money moved, so
 *    the truth is derived conservatively from the text, and anything unclear
 *    is set aside as ambiguous rather than guessed.
 * 3. `v1,v2` — ham or spam (the UCI SMS Spam Collection): nothing in it is a
 *    bank's payment alert, so every message must not count.
 */

import { DETECTION_KINDS, type DetectionKind } from '@/domain/txn-detect';
import { groupOf, type CorpusGroup } from '@/domain/txn-detect/model/corpus';

export type BenchRow = {
  id: string;
  body: string;
  sender: string | null;
  packageName: string | null;
  truth: DetectionKind;
  group: CorpusGroup;
  /** Why the truth is what it is, for the report. */
  why: string;
};

/** RFC 4180-ish: quoted fields, doubled quotes, line breaks inside quotes, CRLF, a BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

const OFFER =
  /\b(?:offer|cashback|discount|voucher|coupon|sale|deal|upgrade now|redeem|use code|buy 1|flat \d+|% off|pre-?approved|apply now|exclusive)\b/i;
const DEBIT = /\b(?:debited|spent|withdrawn|deducted)\b|\bdebit by\b|\bpurchase of\b.*\bcompleted\b/i;
const CREDIT = /\bcredited to (?:your|ur)\b/i;
const NOT_MONEY = /\b(?:otp|will be|due|failed|declined|mandate|reminder|nsdl|cdsl)\b/i;
const ANY_MONEY =
  /\b(?:debit\w*|credit\w*|spent|paid|pay|sent|received|withdrawn|payment|refund\w*|purchase\w*|deduct\w*|txn|transaction\w*|transfer\w*|emi|auto-?debit|upi|a\/?c|acct|account)\b/i;

/** A promotional or service message, as far as can be told without trusting the reader. */
export function truthOfCategory(body: string, category: string): Pick<BenchRow, 'truth' | 'group' | 'why'> {
  const service = category.trim().toLowerCase() === 'service';
  const offer = OFFER.test(body);
  if (service && !offer && !NOT_MONEY.test(body) && DEBIT.test(body)) {
    return { truth: 'transaction', group: 'must_capture', why: 'debit alert' };
  }
  if (service && !offer && !NOT_MONEY.test(body) && CREDIT.test(body)) {
    return { truth: 'transaction', group: 'must_capture', why: 'credit alert' };
  }
  if (!ANY_MONEY.test(body)) {
    return service
      ? { truth: 'unknown', group: 'must_not_count', why: 'service notice' }
      : { truth: 'promo', group: 'must_not_count', why: 'offer' };
  }
  return { truth: 'unknown', group: 'ambiguous', why: service ? 'service, unclear' : 'offer naming money' };
}

const column = (header: readonly string[], name: string): number => header.findIndex((cell) => cell.trim().toLowerCase() === name);

/** Every row of a dataset with its truth. Throws on a header it does not know. */
export function readDataset(text: string): BenchRow[] {
  const [header, ...rows] = parseCsv(text);
  if (header === undefined) return [];
  const body = column(header, 'body');
  const kind = column(header, 'kind');
  const message = column(header, 'message');
  const category = column(header, 'category');
  const v1 = column(header, 'v1');
  const v2 = column(header, 'v2');
  const sender = column(header, 'sender');
  const packageName = column(header, 'packagename');
  const cell = (cells: string[], index: number): string | null =>
    index === -1 || cells[index] === undefined || cells[index].trim() === '' ? null : cells[index];

  if (body !== -1 && kind !== -1) {
    return rows.map((cells, index) => {
      const truth = (cell(cells, kind) ?? 'unknown').trim() as DetectionKind;
      if (!DETECTION_KINDS.includes(truth)) throw new Error(`row ${index + 2}: unknown kind ${truth}`);
      return {
        id: `row ${index + 2}`,
        body: cell(cells, body) ?? '',
        sender: cell(cells, sender),
        packageName: cell(cells, packageName),
        truth,
        group: groupOf({ kind: truth }),
        why: `labelled ${truth}`,
      };
    });
  }
  if (message !== -1 && category !== -1) {
    return rows.map((cells, index) => ({
      id: `row ${index + 2}`,
      body: cell(cells, message) ?? '',
      sender: null,
      packageName: null,
      ...truthOfCategory(cell(cells, message) ?? '', cell(cells, category) ?? ''),
    }));
  }
  if (v1 !== -1 && v2 !== -1) {
    return rows.map((cells, index) => ({
      id: `row ${index + 2}`,
      body: cell(cells, v2) ?? '',
      sender: null,
      packageName: null,
      truth: 'unknown' as DetectionKind,
      group: 'must_not_count' as CorpusGroup,
      why: cell(cells, v1) ?? 'message',
    }));
  }
  throw new Error(`Unknown dataset header: ${header.join(', ')}. Expected body,kind or message,category or v1,v2.`);
}
