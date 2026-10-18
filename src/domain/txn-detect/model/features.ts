/**
 * What the detector's model sees of a message (D21): hashed features of its
 * skeleton and of where it came from.
 *
 * The model is trained on skeletons, because skeletons are the only form a
 * message ever reaches the developer in, so it must read a skeleton on the
 * phone as well — the same function on both sides, or it learns one thing and
 * is asked about another. That costs it the merchant's name, which never said
 * whether money moved, and keeps everything that does: the bank's wording, its
 * abbreviations and glued tokens (character n-grams), its words and their
 * order (word uni- and bigrams), and the facts around the text — the sender's
 * TRAI suffix, the app, whether a bank is named, which gates the text trips.
 *
 * Features are hashed into a fixed number of buckets with 32-bit FNV-1a, and a
 * message becomes the sorted set of buckets it touches. Character n-grams are
 * hashed in one pass per position without building substrings: this runs on
 * every captured payment.
 *
 * `FEATURE_VERSION` goes up with any change here or in the skeleton's
 * vocabulary, and the evaluation then refuses the model until it is retrained.
 */

import { gateSignals } from '../classify';
import { normaliseText } from '../normalise';
import { isSmsApp, resolveIssuer, senderSuffix } from '../sources';

export const FEATURE_VERSION = 1;

/** What the model reads: a skeleton, and who sent it. */
export type ModelInput = {
  skeleton: string;
  sender: string | null;
  title: string | null;
  packageName: string | null;
};

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/* Kept as a signed 32-bit integer: only the low bits survive the bucket mask,
   and they are the same either way, without a conversion on every step. */
const step = (hash: number, code: number): number => Math.imul(hash ^ code, FNV_PRIME);

function hashString(value: string, seed: number = FNV_OFFSET): number {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) hash = step(hash, value.charCodeAt(index));
  return hash;
}

const CHAR_SEED = hashString('c:');
const MIN_GRAM = 3;
const MAX_GRAM = 5;

/** A skeleton's word shapes keep their case — `Aa` is a name, `AA` a merchant — and figures their length. */
function wordToken(word: string): string {
  if (/^(?:A|a|Aa|AA|aa)$/.test(word)) return `#${word}`;
  if (/^9+$/.test(word)) return `9x${Math.min(word.length, 13)}`;
  return word.toLowerCase();
}

export const viaOf = (packageName: string | null): 'sms' | 'app' | 'paste' =>
  packageName === null ? 'paste' : isSmsApp(packageName) ? 'sms' : 'app';

/**
 * The features as strings, before hashing. For tests and for reading what a
 * trained model leans on; `featuresOf` never builds these.
 */
export function featureNamesOf(input: ModelInput): string[] {
  const names: string[] = [];
  const text = normaliseText(input.skeleton);
  const padded = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  for (let start = 0; start + MIN_GRAM <= padded.length; start += 1) {
    for (let size = MIN_GRAM; size <= MAX_GRAM && start + size <= padded.length; size += 1) {
      names.push(`c:${padded.slice(start, start + size)}`);
    }
  }
  names.push(...structuralNames(input, text));
  return names;
}

function structuralNames(input: ModelInput, text: string): string[] {
  const names: string[] = [];
  const words = text
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0)
    .map(wordToken);
  words.forEach((word, index) => {
    names.push(`w:${word}`);
    if (index > 0) names.push(`b:${words[index - 1]} ${word}`);
  });
  const via = viaOf(input.packageName);
  names.push(`s:sfx:${senderSuffix(input.sender) ?? senderSuffix(input.title) ?? 'none'}`);
  names.push(`s:via:${via}`);
  if (via === 'app') names.push(`s:pkg:${input.packageName}`);
  names.push(`s:issuer:${resolveIssuer({ sender: input.sender, title: input.title, body: input.skeleton }) === null ? 0 : 1}`);
  names.push(`s:lines:${Math.min(text.split('\n').length, 6)}`);
  for (const gate of gateSignals(text)) names.push(`s:gate:${gate}`);
  return names;
}

/* One buffer, reused: a message touches a few hundred buckets, and a Set of
   them per message cost more than everything else the model does. */
let scratch = new Uint32Array(2048);

/** The sorted, distinct buckets a message touches. `buckets` is a power of two. */
export function featuresOf(input: ModelInput, buckets: number): Uint32Array {
  const mask = buckets - 1;
  const text = normaliseText(input.skeleton);
  const padded = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const names = structuralNames(input, text);

  const needed = padded.length * (MAX_GRAM - MIN_GRAM + 1) + names.length;
  if (scratch.length < needed) scratch = new Uint32Array(needed * 2);
  let count = 0;

  for (let start = 0; start + MIN_GRAM <= padded.length; start += 1) {
    let hash = CHAR_SEED;
    for (let size = 1; size <= MAX_GRAM && start + size <= padded.length; size += 1) {
      hash = step(hash, padded.charCodeAt(start + size - 1));
      if (size >= MIN_GRAM) scratch[count++] = hash & mask;
    }
  }
  for (const name of names) scratch[count++] = hashString(name) & mask;

  const sorted = scratch.subarray(0, count).sort();
  let distinct = 0;
  for (let index = 0; index < count; index += 1) {
    if (index === 0 || sorted[index] !== sorted[index - 1]) sorted[distinct++] = sorted[index];
  }
  return sorted.slice(0, distinct);
}

/** The same hash `featuresOf` uses, so a test can say which bucket a name lands in. */
export const bucketOf = (name: string, buckets: number): number =>
  (name.startsWith('c:') ? hashString(name.slice(2), CHAR_SEED) : hashString(name)) & (buckets - 1);
