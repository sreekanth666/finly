/**
 * The detector model as it ships (D21): one JSON file, trained by
 * `pnpm train:detector`, and what the app makes of it.
 *
 * Weights are int8 behind a single scale, base64-encoded — a 65,536-bucket
 * model is about 87 KB on disk and 64 KB in memory. Decoded once, on first
 * use. The base64 reader is written out here rather than taken from `atob` or
 * `Buffer`, which the app's JavaScript engine and the tests do not both have.
 */

export type ModelFile = {
  format: 1;
  version: number;
  featureVersion: number;
  buckets: number;
  bias: number;
  scale: number;
  /** Base64 of `buckets` signed bytes. */
  weights: string;
  /** How many of the user's own labels weigh as much as the model (see `doubt.ts`). */
  alpha: number;
  /**
   * Probability of "not a payment" at which a payment is doubted; null when
   * training found no evidence the model can doubt safely, and it doubts
   * nothing. `filter` is reserved and unused.
   */
  threshold: { doubt: number | null; filter: number | null };
  trainedOn: { corpusHash: string; rows: number; variants: number };
  metrics: Record<string, number>;
};

export type Model = {
  version: number;
  featureVersion: number;
  buckets: number;
  bias: number;
  scale: number;
  weights: Int8Array;
  alpha: number;
  threshold: { doubt: number | null; filter: number | null };
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(128);
for (let index = 0; index < ALPHABET.length; index += 1) LOOKUP[ALPHABET.charCodeAt(index)] = index;

export function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let out = 0;
  for (let index = 0; index + 1 < clean.length; index += 4) {
    const a = LOOKUP[clean.charCodeAt(index)];
    const b = LOOKUP[clean.charCodeAt(index + 1)];
    const c = index + 2 < clean.length ? LOOKUP[clean.charCodeAt(index + 2)] : 0;
    const d = index + 3 < clean.length ? LOOKUP[clean.charCodeAt(index + 3)] : 0;
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (out < bytes.length) bytes[out++] = (triple >> 16) & 0xff;
    if (index + 2 < clean.length && out < bytes.length) bytes[out++] = (triple >> 8) & 0xff;
    if (index + 3 < clean.length && out < bytes.length) bytes[out++] = triple & 0xff;
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let text = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    text += ALPHABET[(triple >> 18) & 63] + ALPHABET[(triple >> 12) & 63];
    text += index + 1 < bytes.length ? ALPHABET[(triple >> 6) & 63] : '=';
    text += index + 2 < bytes.length ? ALPHABET[triple & 63] : '=';
  }
  return text;
}

export function decodeModel(file: ModelFile): Model {
  const bytes = decodeBase64(file.weights);
  if (bytes.length !== file.buckets) throw new Error(`model has ${bytes.length} weights for ${file.buckets} buckets`);
  return {
    version: file.version,
    featureVersion: file.featureVersion,
    buckets: file.buckets,
    bias: file.bias,
    scale: file.scale,
    weights: new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length),
    alpha: file.alpha,
    threshold: file.threshold,
  };
}

const sigmoid = (value: number): number => 1 / (1 + Math.exp(-value));

/** The model's probability that a message is not a payment. */
export function scoreOf(model: Model, features: Uint32Array): number {
  let sum = 0;
  for (let index = 0; index < features.length; index += 1) sum += model.weights[features[index]];
  return sigmoid(model.bias + model.scale * sum);
}
