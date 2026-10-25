#!/usr/bin/env node
/**
 * Adds the reviewed messages in a support report to the detector corpus (D21).
 *
 * A report sent with "Help improve detection" switched on carries, in its
 * machine-readable last line, a skeleton of each message the user reviewed and
 * the verdict their action makes it. This copies the labelled ones into
 * data/detector/corpus.jsonl, once each, in id order.
 *
 * It only moves data: what a verdict means is decided in
 * src/domain/support/labelled.ts, and whether a row is a usable skeleton is
 * checked by `pnpm check`, which refuses the corpus otherwise. Read every new
 * row before committing it — a skeleton removes names it can recognise, and
 * nothing else.
 *
 * Run: pnpm detector:import <finly-report.txt> --source report|owner|volunteer [--include-unlabelled]
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CORPUS = join(ROOT, 'data', 'detector', 'corpus.jsonl');
const SOURCES = ['report', 'owner', 'volunteer'];
/* Only an id with its operator prefix: a bare six letters can be a contact's
   name. The report already drops anything less (isDltSenderId); this is the
   second lock, and pnpm check is the third. */
const SENDER_ID = /^[A-Z]{2}-[A-Z0-9]{6}(?:-[A-Z])?$/i;

function fail(message) {
  console.error(message);
  console.error('Usage: pnpm detector:import <finly-report.txt> --source report|owner|volunteer [--include-unlabelled]');
  process.exit(1);
}

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--') && args[args.indexOf(arg) - 1] !== '--source');
const source = args[args.indexOf('--source') + 1];
const includeUnlabelled = args.includes('--include-unlabelled');
if (file === undefined) fail('Name the report file.');
if (!args.includes('--source') || !SOURCES.includes(source)) fail(`--source is one of ${SOURCES.join(', ')}.`);

/** The JSON line that follows "MACHINE-READABLE" in a report. */
function payloadOf(text) {
  const lines = text.split(/\r?\n/);
  const marker = lines.findIndex((line) => line.trim() === 'MACHINE-READABLE');
  const json = marker === -1 ? undefined : lines.slice(marker + 1).find((line) => line.trim().startsWith('{'));
  if (json === undefined) fail('No MACHINE-READABLE line in that file. Is it a finly-report.txt?');
  try {
    return JSON.parse(json);
  } catch {
    fail('The MACHINE-READABLE line is not JSON. Was the report edited?');
  }
}

const payload = payloadOf(readFileSync(file, 'utf8'));
const labelled = Array.isArray(payload.labelled) ? payload.labelled : [];
if (labelled.length === 0) fail('That report has no reviewed messages. Was "Help improve detection" switched on?');

const existing = readFileSync(CORPUS, 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => JSON.parse(line));
const ids = new Set(existing.map((row) => row.id));

const added = [];
let skipped = 0;
let unlabelled = 0;

for (const shape of labelled) {
  if (typeof shape?.skeleton !== 'string' || shape.skeleton.trim() === '' || shape.skeleton.length > 1000) {
    skipped += 1;
    continue;
  }
  const sender = typeof shape.sender === 'string' && SENDER_ID.test(shape.sender) ? shape.sender : null;
  const packageName = typeof shape.packageName === 'string' ? shape.packageName : null;
  let truth = shape.truth;
  if (truth == null) {
    unlabelled += 1;
    if (!includeUnlabelled) continue;
    /* Kept for a person to relabel; never scored as it stands. */
    truth = { kind: typeof shape.read === 'string' ? shape.read : 'unknown', group: 'ambiguous' };
  }
  const id = `${source}:${createHash('sha1')
    .update([sender ?? '', packageName ?? '', shape.skeleton, truth.kind, truth.group ?? ''].join('|'))
    .digest('hex')
    .slice(0, 12)}`;
  if (ids.has(id)) {
    skipped += 1;
    continue;
  }
  ids.add(id);
  added.push({
    id,
    body: shape.skeleton,
    sender,
    title: null,
    packageName,
    kind: truth.kind,
    ...(truth.group === undefined ? {} : { group: truth.group }),
    source,
    note: `read as ${shape.read}; ${shape.verdict}`,
  });
}

const rows = [...existing, ...added].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
writeFileSync(CORPUS, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);

console.log(
  `Added ${added.length} row(s) to data/detector/corpus.jsonl; ${skipped} already there or unusable, ${unlabelled} without a verdict${includeUnlabelled ? ' (kept as ambiguous)' : ' (left out)'}.`,
);
console.log('Read the new rows, then run pnpm check and pnpm detector:eval.');
