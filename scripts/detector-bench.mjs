#!/usr/bin/env node
/**
 * Runs an outside SMS dataset through the reader, the way a phone would (D21).
 *
 * Accepts a CSV with a header of `body,kind[,sender,packageName]`,
 * `message,category` (promotional/service) or `v1,v2` (ham/spam). Keep
 * datasets in dataset/, which git ignores; the failures it finds are written
 * to dataset/.bench/ to be read and turned into fixtures.
 *
 * Run: pnpm detector:bench <file.csv> [--limit N]
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const limitAt = args.indexOf('--limit');
const limit = limitAt === -1 ? '' : args[limitAt + 1];
const file = args.find((arg, index) => !arg.startsWith('--') && (limitAt === -1 || index !== limitAt + 1));

if (file === undefined) {
  console.error('Usage: pnpm detector:bench <file.csv> [--limit N]');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(1);
}
if (limitAt !== -1 && !/^\d+$/.test(limit ?? '')) {
  console.error('--limit takes a whole number of rows.');
  process.exit(1);
}

const result = spawnSync('pnpm', ['exec', 'jest', '--config', 'scripts/detector/bench.config.js', '--runInBand'], {
  stdio: 'inherit',
  env: { ...process.env, DETECTOR_BENCH_FILE: resolve(file), DETECTOR_BENCH_LIMIT: limit ?? '' },
});
process.exit(result.status ?? 1);
