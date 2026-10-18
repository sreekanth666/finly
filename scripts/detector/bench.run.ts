/**
 * Runs an outside SMS dataset through everything a message meets on the phone
 * (D21): the native capture gate, the reader, the inbox's sections with every
 * doubt and filing, and the shipped model. Never part of `pnpm check` — the
 * datasets live in `dataset/`, which git ignores.
 *
 * Prints the corpus's own numbers for every row and for distinct shapes
 * (digits collapsed, so one template sent ten thousand times counts once), and
 * writes the failures to `dataset/.bench/`, to be read and turned into
 * fixtures.
 *
 * Run: pnpm detector:bench <file.csv> [--limit N]
 */

import { basename, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { detect, isDoubted, isFiled, isSmsApp, sectionOf } from '@/domain/txn-detect';
import { MOVED_KINDS } from '@/domain/txn-detect/classify';
import { assess, shippedModel } from '@/domain/txn-detect/model/assess';
import { describeMetrics, evaluate, type Scored } from '@/domain/txn-detect/model/metrics';
import { isDltSenderId } from '@/domain/txn-detect/sources';

import { readDataset, type BenchRow } from '../../src/domain/__tests__/fixtures/bench-truth';
import { gateKeepsSms, readGatePattern } from '../../src/domain/__tests__/fixtures/capture-gate';

const SMS_APP = 'com.google.android.apps.messaging';
const READ_AT = new Date(2026, 9, 1, 12, 0).getTime();
const SAMPLE_LIMIT = 400;

const shapeOf = (body: string): string => body.toLowerCase().replace(/\d+/g, '9');

type Reading = Scored & { row: BenchRow; dropped: boolean; reasons: string[]; score: number | null };

function read(row: BenchRow, money: RegExp): Reading {
  const packageName = row.packageName ?? SMS_APP;
  const input = {
    body: row.body,
    sender: isDltSenderId(row.sender) ? row.sender : null,
    title: null,
    packageName,
    receivedAt: READ_AT,
  };
  const base = { id: row.id, senderKey: input.sender ?? packageName, truth: row.truth, group: row.group, row };
  const dropped = isSmsApp(packageName) ? !gateKeepsSms(money, row.body) : !/\d/.test(row.body);
  if (dropped) return { ...base, placed: { kind: 'unknown', section: 'filtered' }, dropped, reasons: ['gate:dropped'], score: null };
  const detection = detect(input);
  const section = sectionOf({ ...detection, doubt: isDoubted(detection.reasons), filed: isFiled(detection.reasons) });
  return {
    ...base,
    placed: { kind: detection.kind, section },
    dropped,
    reasons: detection.reasons,
    score: assess(input, detection)?.score ?? null,
  };
}

function summary(label: string, readings: readonly Reading[]): string {
  const metrics = evaluate(readings);
  const counted = readings.filter((reading) => reading.group === 'must_not_count');
  const asTransaction = counted.filter((reading) => reading.placed.kind === 'transaction').length;
  const dropped = readings.filter((reading) => reading.group === 'must_capture' && reading.dropped).length;
  const scored = readings.filter((reading) => reading.score !== null && reading.group !== 'ambiguous');
  const tenths = (group: string) =>
    Array.from({ length: 10 }, (_, tenth) =>
      scored.filter((reading) => reading.group === group && Math.min(9, Math.floor(reading.score! * 10)) === tenth).length,
    ).join(' ');
  return [
    describeMetrics(label, metrics),
    `  of the lost, dropped by the capture gate: ${dropped}`,
    `  must-not-count read as a transaction: ${asTransaction} of ${counted.length}`,
    `  model scores by tenth — must capture: ${tenths('must_capture')} | must not count: ${tenths('must_not_count')}`,
  ].join('\n');
}

it('benchmarks the reader on a dataset', () => {
  const file = process.env.DETECTOR_BENCH_FILE;
  if (file === undefined || file === '') throw new Error('Run it as: pnpm detector:bench <file.csv>');
  const limit = Number(process.env.DETECTOR_BENCH_LIMIT ?? '0');

  const all = readDataset(readFileSync(file, 'utf8'));
  const rows = limit > 0 ? all.slice(0, limit) : all;
  const money = readGatePattern();
  const readings = rows.map((row) => read(row, money));

  const seen = new Set<string>();
  const distinct = readings.filter((reading) => {
    const shape = shapeOf(reading.row.body);
    if (seen.has(shape)) return false;
    seen.add(shape);
    return true;
  });

  const out = join(process.cwd(), 'dataset', '.bench');
  mkdirSync(out, { recursive: true });
  const stem = basename(file).replace(/\.[^.]+$/, '');
  const line = (reading: Reading) =>
    `${reading.placed.section} ${reading.placed.kind} [${reading.reasons.filter((reason) => /^(kind|doubt|file|transfer|amount|gate):/.test(reason)).join(',')}] (${reading.row.why}) | ${reading.row.body.replace(/\s+/g, ' ')}`;
  const samples: Record<string, Reading[]> = {
    lost: distinct.filter((reading) => reading.group === 'must_capture' && !MOVED_KINDS.includes(reading.placed.kind)),
    'in-badge': distinct.filter(
      (reading) => reading.group === 'must_not_count' && (reading.placed.section === 'review' || reading.placed.section === 'maybe'),
    ),
    ambiguous: distinct.filter((reading) => reading.group === 'ambiguous'),
  };
  for (const [name, list] of Object.entries(samples)) {
    writeFileSync(join(out, `${stem}-${name}.txt`), `${list.slice(0, SAMPLE_LIMIT).map(line).join('\n')}\n`);
  }

  const groups = (list: readonly Reading[]) =>
    ['must_capture', 'must_not_count', 'ambiguous'].map((group) => `${group} ${list.filter((reading) => reading.group === group).length}`).join(', ');
  console.log(
    [
      `${basename(file)}: ${rows.length} rows (${groups(readings)}); ${distinct.length} distinct shapes (${groups(distinct)})`,
      `Model ${shippedModel().version}, doubt at ${shippedModel().threshold.doubt ?? 'none'}`,
      '',
      summary('every row', readings),
      '',
      summary('distinct shapes', distinct),
      '',
      `Samples (distinct shapes, up to ${SAMPLE_LIMIT} each) in dataset/.bench/${stem}-{lost,in-badge,ambiguous}.txt`,
    ].join('\n'),
  );
});
