/**
 * The native capture gate (D17), as JavaScript: the pattern is read out of
 * CaptureGate.kt itself, so the tests and the benchmark judge exactly what
 * the phone ships.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GATE = join(
  process.cwd(),
  'modules',
  'finly-capture',
  'android',
  'src',
  'main',
  'java',
  'com',
  'thecstudio',
  'finly',
  'capture',
  'CaptureGate.kt',
);

/** `private val MONEY = Regex("(?i)…")`, as a JavaScript RegExp. */
export function readGatePattern(source: string = readFileSync(GATE, 'utf8')): RegExp {
  const match = /private val MONEY = Regex\(\s*"((?:[^"\\]|\\.)*)"\s*\)/.exec(source);
  if (match === null) throw new Error('MONEY not found in CaptureGate.kt');
  const pattern = match[1].replace(/\\\\/g, '\\');
  const insensitive = pattern.startsWith('(?i)');
  return new RegExp(insensitive ? pattern.slice('(?i)'.length) : pattern, insensitive ? 'i' : '');
}

/** What the gate keeps from an SMS app: a digit and a money word. A payment app's text needs only the digit. */
export const gateKeepsSms = (money: RegExp, text: string): boolean => /\d/.test(text) && money.test(text);
