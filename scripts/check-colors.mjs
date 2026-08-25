#!/usr/bin/env node
/**
 * Guards the "no hardcoded colors" rule.
 *
 * Every color in the app must come from a design token in
 * src/theme/tokens.css — used as a Tailwind utility (`bg-surface`) or resolved
 * through `useAppColor()` from `@/theme`. This script fails if a raw color
 * literal shows up anywhere else under src/.
 *
 * Run: pnpm run check:colors
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIR = join(ROOT, 'src');
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.css'];

/** The token definitions themselves, plus generated files. */
const ALLOWED_FILES = new Set(['src/theme/tokens.css', 'src/uniwind-types.d.ts']);

const NAMED_COLORS = [
  'aqua', 'beige', 'black', 'blue', 'brown', 'coral', 'crimson', 'cyan', 'fuchsia',
  'gold', 'gray', 'green', 'grey', 'indigo', 'ivory', 'khaki', 'lavender', 'lime',
  'magenta', 'maroon', 'navy', 'olive', 'orange', 'orchid', 'pink', 'plum', 'purple',
  'red', 'salmon', 'silver', 'tan', 'teal', 'tomato', 'turquoise', 'violet', 'wheat',
  'white', 'yellow',
];

const RULES = [
  { label: 'hex color', pattern: /#[0-9a-fA-F]{3,8}\b/g },
  { label: 'color function', pattern: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\s*\(/g },
  { label: 'named color', pattern: new RegExp(`(['"\`])(${NAMED_COLORS.join('|')})\\1`, 'gi') },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (SCAN_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      yield path;
    }
  }
}

const violations = [];

for (const path of walk(SCAN_DIR)) {
  const relativePath = relative(ROOT, path);
  if (ALLOWED_FILES.has(relativePath)) continue;

  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const { label, pattern } of RULES) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        violations.push(`${relativePath}:${index + 1}  ${label}  ${match[0]}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`Found ${violations.length} hardcoded color(s):\n`);
  for (const violation of violations) console.error(`  ${violation}`);
  console.error('\nUse a token from src/theme/tokens.css instead (className, or useAppColor).');
  process.exit(1);
}

console.log('No hardcoded colors found in src/.');
