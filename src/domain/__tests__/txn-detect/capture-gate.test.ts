import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AUTHORED_MESSAGES } from '../fixtures/authored-messages';
import { ALL_MESSAGES } from '../fixtures/messages';

/*
 * The native gate decides what an SMS app's notification must contain before
 * anything is stored (D17): a digit and a money word. It runs in Kotlin, so
 * this reads the pattern out of CaptureGate.kt itself and holds it to the
 * corpus here — the two cannot drift apart.
 */

const GATE = join(process.cwd(), 'modules', 'finly-capture', 'android', 'src', 'main', 'java', 'com', 'thecstudio', 'finly', 'capture', 'CaptureGate.kt');

/** `private val MONEY = Regex("(?i)…")`, as a JavaScript RegExp. */
export function readGatePattern(source: string = readFileSync(GATE, 'utf8')): RegExp {
  const match = /private val MONEY = Regex\(\s*"((?:[^"\\]|\\.)*)"\s*\)/.exec(source);
  if (match === null) throw new Error('MONEY not found in CaptureGate.kt');
  const pattern = match[1].replace(/\\\\/g, '\\');
  const insensitive = pattern.startsWith('(?i)');
  return new RegExp(insensitive ? pattern.slice('(?i)'.length) : pattern, insensitive ? 'i' : '');
}

const MONEY = readGatePattern();
const kept = (text: string): boolean => /\d/.test(text) && MONEY.test(text);

const MOVED = ['transaction', 'transfer', 'refund'];

describe('the native capture gate', () => {
  it('keeps every message in the corpus that moved money', () => {
    const dropped = [
      ...ALL_MESSAGES.filter((fixture) => MOVED.includes(fixture.expected.kind ?? '')).map((fixture) => [fixture.name, fixture.input.body]),
      ...AUTHORED_MESSAGES.filter((message) => MOVED.includes(message.kind)).map((message) => [message.id, message.body]),
    ]
      .filter(([, body]) => !kept(body))
      .map(([name]) => name);
    expect(dropped).toEqual([]);
  });

  it('never stores a chat that only shares letters with a money word', () => {
    for (const chat of [
      'Have a great time in Goa - send me a postcard ! 1 week to go',
      "Meds say take once every 8 hours. It's only been 5",
      "As per your request 'Melle Melle' has been set as your callertune for all Callers. Press *9 to copy",
      'It was a lovely present, thanks! See you at 7',
    ]) {
      expect([chat, kept(chat)]).toEqual([chat, false]);
    }
  });

  it('still keeps the shapes a bank writes money in', () => {
    for (const alert of ['Rs.500 debited', 'INR500 spent', '₹ 99 at SWIGGY', 'Rs: 1,200 credited', 'A/c XX1234 debited by 20.0', 'Txn of 450.00 on card XX12']) {
      expect([alert, kept(alert)]).toEqual([alert, true]);
    }
  });
});
