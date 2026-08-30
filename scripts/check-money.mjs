#!/usr/bin/env node
/**
 * Guards the "one money module" rule.
 *
 * Every rupee figure in the app is an integer number of paise formatted by
 * src/domain/money.ts. This script fails if a file starts formatting money on
 * its own again — a `$` template, a `.toFixed(2)`, or a locale-pinned
 * `toLocaleString`, all three of which the design pass had scattered across
 * eight files and which produced US grouping on an INR app.
 *
 * Run: pnpm run check:money
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIR = join(ROOT, 'src');
const SCAN_EXTENSIONS = ['.ts', '.tsx'];

/** money.ts is the one place allowed to do this; its tests assert on it. */
const ALLOWED_FILES = new Set(['src/domain/money.ts']);
const ALLOWED_DIRS = ['src/domain/__tests__'];

const RULES = [
  {
    label: 'hardcoded currency symbol in a template',
    pattern: /\$\$\{|`[^`]*\$(?![{$])[^`]*`/g,
    hint: 'use formatMinor() — the symbol comes from money.ts',
  },
  {
    label: 'toFixed()',
    pattern: /\.toFixed\s*\(/g,
    hint: 'money is an integer; use formatMinor() or formatMinorParts()',
  },
  {
    label: 'toLocaleString()',
    pattern: /\.toLocaleString\s*\(/g,
    hint: 'grouping is Indian and lives in groupIndian() — never a locale string',
  },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (SCAN_EXTENSIONS.some((extension) => path.endsWith(extension))) {
      yield path;
    }
  }
}

const failures = [];

for (const path of walk(SCAN_DIR)) {
  const relativePath = relative(ROOT, path).split('\\').join('/');
  if (ALLOWED_FILES.has(relativePath)) continue;
  if (ALLOWED_DIRS.some((dir) => relativePath.startsWith(`${dir}/`))) continue;

  const lines = readFileSync(path, 'utf8').split('\n');

  lines.forEach((line, index) => {
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(line)) {
        failures.push({
          location: `${relativePath}:${index + 1}`,
          label: rule.label,
          hint: rule.hint,
          line: line.trim(),
        });
      }
    }
  });
}

if (failures.length === 0) {
  console.log('No hand-rolled money formatting in src/.');
  process.exit(0);
}

console.error(`Found ${failures.length} place(s) formatting money by hand:\n`);
for (const failure of failures) {
  console.error(`  ${failure.location}  ${failure.label}`);
  console.error(`    ${failure.line}`);
  console.error(`    → ${failure.hint}\n`);
}
process.exit(1);
