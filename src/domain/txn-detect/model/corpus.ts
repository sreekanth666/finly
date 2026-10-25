/**
 * The labelled corpus the detector is measured and trained on (D21).
 *
 * A row is a message reduced to its skeleton (`skeletonOf`, D19) and the kind a
 * person decided it is. Skeletons are the only form messages ever reach the
 * developer in, so they are also the only form the corpus holds, whatever the
 * source. The proof is cheap: a skeleton is a fixed point of `skeletonOf`, and
 * a row whose body is not one is refused.
 *
 * Everything that can be derived is derived, never stored: who sent it, which
 * group it belongs to, and which side of the split it falls on. The split is by
 * sender, not by row — one bank's alerts are near copies of each other, and a
 * random split would put the same template on both sides and flatter every
 * number the evaluation prints.
 */

import { skeletonOf } from '@/domain/support/skeleton';

import { hash53 } from '../hash';
import { isDltSenderId, isSmsApp, senderHeader, senderSuffix } from '../sources';
import { DETECTION_KINDS, type DetectionKind } from '../types';

export const CORPUS_GROUPS = ['must_capture', 'must_not_count', 'ambiguous'] as const;
/**
 * - **must_capture**: money moved; the reader must keep it as a transaction, a
 *   transfer or a refund.
 * - **must_not_count**: no money moved, or not the user's; it must never sit in
 *   the badge as spending.
 * - **ambiguous**: people would disagree. Reported, never scored.
 */
export type CorpusGroup = (typeof CORPUS_GROUPS)[number];

export type Split = 'train' | 'eval';

const PLAIN_SOURCES = ['fixture', 'authored', 'report', 'owner', 'volunteer', 'synthetic'] as const;
/** `public:<id>` names a dataset listed, with its licence, in `data/detector/sources.json`. */
export type CorpusSource = (typeof PLAIN_SOURCES)[number] | `public:${string}`;

export type CorpusRow = {
  id: string;
  /** The skeleton, never the message. */
  body: string;
  /** A DLT sender id such as `JD-HDFCBK-S`. Never a phone number. */
  sender: string | null;
  /** A notification title, skeletoned like the body. */
  title: string | null;
  packageName: string | null;
  /** What a person decided this message is. */
  kind: DetectionKind;
  /** When the kind alone does not say it — a friend's "I sent you ₹500" is `unknown` and must not count. */
  group?: CorpusGroup;
  source: CorpusSource;
  /** The row a synthetic variant was made from. */
  parent?: string | null;
  note?: string;
};

const MOVED: readonly DetectionKind[] = ['transaction', 'transfer', 'refund'];

export const groupOf = (row: Pick<CorpusRow, 'kind' | 'group'>): CorpusGroup =>
  row.group ?? (MOVED.includes(row.kind) ? 'must_capture' : row.kind === 'unknown' ? 'ambiguous' : 'must_not_count');

/** Who sent it, as stably as can be told: the DLT header, else the app, else where it came from. */
export function senderKeyOf(row: Pick<CorpusRow, 'sender' | 'title' | 'packageName'>): string {
  const header = senderHeader(row.sender) ?? senderHeader(row.title);
  if (header !== null) return header;
  if (row.packageName != null) return isSmsApp(row.packageName) ? 'sms' : row.packageName;
  return 'paste';
}

export const suffixOf = (row: Pick<CorpusRow, 'sender' | 'title'>): 'P' | 'S' | 'T' | 'G' | null =>
  senderSuffix(row.sender) ?? senderSuffix(row.title);

/** Made-up and borrowed text trains; only real messages judge. */
export const isTrainOnly = (source: CorpusSource): boolean => source === 'synthetic' || source.startsWith('public:');

/** One sender in five is held out, decided by its key so it never moves. */
export function splitOf(row: Pick<CorpusRow, 'sender' | 'title' | 'packageName' | 'source'>): Split {
  if (isTrainOnly(row.source)) return 'train';
  return parseInt(hash53(`split:${senderKeyOf(row)}`).slice(-6), 16) % 5 === 0 ? 'eval' : 'train';
}

/** Rows that differ only in their figures are one template. */
export const templateKeyOf = (body: string): string => hash53(body.toLowerCase().replace(/9+(?:[.,]9+)*/g, '9'));

const KNOWN_FIELDS = new Set(['id', 'body', 'sender', 'title', 'packageName', 'kind', 'group', 'source', 'parent', 'note']);
const MAX_BODY = 1000;

const isSource = (value: unknown, publicSources: ReadonlySet<string>): value is CorpusSource =>
  typeof value === 'string' &&
  ((PLAIN_SOURCES as readonly string[]).includes(value) ||
    (value.startsWith('public:') && publicSources.has(value.slice('public:'.length))));

const nullableString = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || typeof value === 'string';

/** Why a parsed object is not a usable row, or null when it is. */
export function rowProblem(value: unknown, publicSources: ReadonlySet<string> = new Set()): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'not an object';
  const row = value as Record<string, unknown>;
  const unknown = Object.keys(row).filter((key) => !KNOWN_FIELDS.has(key));
  if (unknown.length > 0) return `unknown field ${unknown.join(', ')}`;
  if (typeof row.id !== 'string' || row.id.trim() === '') return 'no id';
  if (typeof row.body !== 'string' || row.body.trim() === '') return 'no body';
  if (row.body.length > MAX_BODY) return `body longer than ${MAX_BODY}`;
  if (skeletonOf(row.body) !== row.body) return 'body is not a skeleton';
  if (!nullableString(row.sender) || !nullableString(row.title) || !nullableString(row.packageName)) {
    return 'sender, title and packageName are strings or null';
  }
  if (typeof row.sender === 'string' && !isDltSenderId(row.sender)) return 'sender is not a DLT sender id';
  if (typeof row.title === 'string' && skeletonOf(row.title) !== row.title) return 'title is not a skeleton';
  if (!(DETECTION_KINDS as readonly unknown[]).includes(row.kind)) return `unknown kind ${String(row.kind)}`;
  if (row.group !== undefined && !(CORPUS_GROUPS as readonly unknown[]).includes(row.group)) {
    return `unknown group ${String(row.group)}`;
  }
  if (!isSource(row.source, publicSources)) return `unknown source ${String(row.source)}`;
  if (row.source === 'synthetic' && (typeof row.parent !== 'string' || row.parent === '')) {
    return 'a synthetic row names its parent';
  }
  if (!nullableString(row.parent) || !nullableString(row.note)) return 'parent and note are strings';
  return null;
}

export type ParsedCorpus = { rows: CorpusRow[]; problems: string[] };

/** JSON Lines: one row per line, blank lines allowed. Every problem is named by its line. */
export function parseCorpus(text: string, publicSources: ReadonlySet<string> = new Set()): ParsedCorpus {
  const rows: CorpusRow[] = [];
  const problems: string[] = [];
  const ids = new Set<string>();

  text.split('\n').forEach((line, index) => {
    if (line.trim() === '') return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      problems.push(`line ${index + 1}: not JSON`);
      return;
    }
    const problem = rowProblem(value, publicSources);
    if (problem !== null) {
      problems.push(`line ${index + 1}: ${problem}`);
      return;
    }
    const row = value as CorpusRow;
    if (ids.has(row.id)) {
      problems.push(`line ${index + 1}: duplicate id ${row.id}`);
      return;
    }
    ids.add(row.id);
    rows.push(row);
  });

  for (const row of rows) {
    if (row.parent != null && !ids.has(row.parent)) problems.push(`${row.id}: parent ${row.parent} is not in the corpus`);
  }
  return { rows, problems };
}

/** One row per line, in id order, so a diff shows only what changed. */
export const serialiseCorpus = (rows: readonly CorpusRow[]): string =>
  [...rows]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((row) => JSON.stringify(row))
    .join('\n') + '\n';

/** A fingerprint of what a model was trained on, so the evaluation can tell a stale model. */
export const corpusHashOf = (rows: readonly CorpusRow[]): string =>
  hash53(
    [...rows]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((row) => [row.id, row.body, row.sender, row.title, row.packageName, row.kind, groupOf(row)].join('\u0001'))
      .join('\u0002'),
  );
