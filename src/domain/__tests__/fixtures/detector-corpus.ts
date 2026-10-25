/**
 * The whole detector corpus (D21), as the evaluation and the trainer see it:
 * the real messages in `data/detector/corpus.jsonl`, plus every message
 * fixture and authored message reduced to its skeleton.
 *
 * The fixtures are read from `messages.ts` rather than copied into the file, so
 * a fixture added for a misread lands in the evaluation the same day, with the
 * kind its expectation states. A fixture that names its owner is left out: the
 * owner's name is exactly what a skeleton removes, and without it a transfer to
 * oneself reads as spending.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { skeletonOf } from '@/domain/support/skeleton';
import { detect, isDoubted, sectionOf, type DetectionKind } from '@/domain/txn-detect';
import {
  groupOf,
  parseCorpus,
  senderKeyOf,
  splitOf,
  type CorpusRow,
  type Split,
} from '@/domain/txn-detect/model/corpus';
import { isAssessable } from '@/domain/txn-detect/model/scope';
import { isDoubtful } from '@/domain/txn-detect/model/doubt';
import { featuresOf } from '@/domain/txn-detect/model/features';
import type { Placement, Scored } from '@/domain/txn-detect/model/metrics';
import { scoreOf, type Model } from '@/domain/txn-detect/model/weights-format';
import { senderHeader } from '@/domain/txn-detect/sources';

import { AUTHORED_MESSAGES } from './authored-messages';
import { ALL_MESSAGES } from './messages';

export const CORPUS_DIR = join(process.cwd(), 'data', 'detector');

/** Every row is read as if it arrived at the same moment; no row's kind depends on its date. */
export const READ_AT = new Date(2026, 9, 1, 12, 0).getTime();

type Dataset = { id: string; licence: string; url: string; note?: string };

export const readJson = <T>(name: string): T => JSON.parse(readFileSync(join(CORPUS_DIR, name), 'utf8')) as T;

export const publicSources = (): Set<string> =>
  new Set(readJson<{ datasets: Dataset[] }>('sources.json').datasets.map((dataset) => dataset.id));

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function fixtureRows(): CorpusRow[] {
  return ALL_MESSAGES.filter((fixture) => fixture.ownerName === undefined && fixture.expected.kind !== undefined).map(
    (fixture) => ({
      id: `fx:${slug(fixture.name)}`,
      body: skeletonOf(fixture.input.body),
      sender: senderHeader(fixture.input.sender) === null ? null : (fixture.input.sender ?? null),
      title: fixture.input.title == null ? null : skeletonOf(fixture.input.title),
      packageName: fixture.input.packageName ?? null,
      kind: fixture.expected.kind as DetectionKind,
      source: 'fixture',
    }),
  );
}

export const authoredRows = (): CorpusRow[] =>
  AUTHORED_MESSAGES.map((message) => ({
    id: message.id,
    body: skeletonOf(message.body),
    sender: message.sender ?? null,
    title: null,
    packageName: message.packageName ?? null,
    kind: message.kind,
    ...(message.group === undefined ? {} : { group: message.group }),
    source: 'authored',
    note: message.note,
  }));

export type LoadedCorpus = { rows: CorpusRow[]; problems: string[] };

export function loadCorpus(): LoadedCorpus {
  const parsed = parseCorpus(readFileSync(join(CORPUS_DIR, 'corpus.jsonl'), 'utf8'), publicSources());
  const rows = [...fixtureRows(), ...authoredRows(), ...parsed.rows];
  const seen = new Set<string>();
  const problems = [...parsed.problems];
  for (const row of rows) {
    if (seen.has(row.id)) problems.push(`duplicate id ${row.id}`);
    seen.add(row.id);
  }
  return { rows, problems };
}

/** Where the rules, alone, put a row. */
export function rulesPlacement(row: CorpusRow): Placement {
  const detection = detect({
    body: row.body,
    title: row.title,
    sender: row.sender,
    packageName: row.packageName,
    receivedAt: READ_AT,
  });
  return { kind: detection.kind, section: sectionOf({ ...detection, doubt: isDoubted(detection.reasons) }) };
}

/** The model's view of a row: the same skeleton and sender the phone would hand it. */
export const modelInputOfRow = (row: CorpusRow) => ({
  skeleton: row.body,
  sender: row.sender,
  title: row.title,
  packageName: row.packageName,
});

export type ModelReading = { placed: Placement; baseline: Placement; score: number | null; assessable: boolean };

/** Where the rules put a row, and where a model's doubt would move it. */
export function modelPlacement(row: CorpusRow, model: Model): ModelReading {
  const detection = detect({
    body: row.body,
    title: row.title,
    sender: row.sender,
    packageName: row.packageName,
    receivedAt: READ_AT,
  });
  const ruleDoubt = isDoubted(detection.reasons);
  const baseline = { kind: detection.kind, section: sectionOf({ ...detection, doubt: ruleDoubt }) };
  if (!isAssessable(detection)) return { placed: baseline, baseline, score: null, assessable: false };
  const score = scoreOf(model, featuresOf(modelInputOfRow(row), model.buckets));
  const doubt = ruleDoubt || isDoubtful(score, undefined, model);
  return {
    placed: { kind: detection.kind, section: sectionOf({ ...detection, doubt }) },
    baseline,
    score,
    assessable: true,
  };
}

export function scoreModel(rows: readonly CorpusRow[], model: Model, split?: Split): Scored[] {
  return rows
    .filter((row) => split === undefined || splitOf(row) === split)
    .map((row) => {
      const reading = modelPlacement(row, model);
      return {
        id: row.id,
        senderKey: senderKeyOf(row),
        truth: row.kind,
        group: groupOf(row),
        placed: reading.placed,
        baseline: reading.baseline,
      };
    });
}

export function scoreRules(rows: readonly CorpusRow[], split?: Split): Scored[] {
  return rows
    .filter((row) => split === undefined || splitOf(row) === split)
    .map((row) => ({
      id: row.id,
      senderKey: senderKeyOf(row),
      truth: row.kind,
      group: groupOf(row),
      placed: rulesPlacement(row),
    }));
}
