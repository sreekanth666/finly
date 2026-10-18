/**
 * Training the detector's model (D21): logistic regression over hashed
 * features, deterministic from its seed, so the same corpus always produces
 * the same file byte for byte.
 *
 * Pure, and run only by `pnpm train:detector` — the app ships the result, never
 * this. Kept in the domain so it is tested like everything else.
 *
 * The label is whether a message must not count (1) or moved money (0); the
 * model is asked only about debits the rules called a transaction, and only
 * ever to doubt them. The doubt threshold is chosen by cross-validation
 * grouped by sender, inside the training split, as the lowest score that
 * demotes no more than a budgeted share of real spending — the held-out
 * senders are never looked at while choosing.
 */

import { hash53 } from '../hash';
import { encodeBase64 } from './weights-format';

export type Example = {
  features: Uint32Array;
  /** 1: must not count. 0: money moved. */
  y: 0 | 1;
  /** The sender, for grouped folds. */
  group: string;
};

export type TrainOptions = { buckets: number; epochs: number; learningRate: number; l2: number; seed: number };

export const DEFAULT_TRAIN_OPTIONS: TrainOptions = {
  buckets: 65_536,
  epochs: 30,
  learningRate: 0.2,
  /* Strong on purpose: with a corpus this small, a weakly regularised model
     scores a format it has never seen as certain, either way. */
  l2: 1e-1,
  seed: 20_261_018,
};

export type Trained = { weights: Float64Array; bias: number };

/** A small seeded generator, so a shuffle is the same on every machine. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const sigmoid = (value: number): number => 1 / (1 + Math.exp(-value));

export function predict(model: Trained, features: Uint32Array): number {
  let sum = model.bias;
  for (let index = 0; index < features.length; index += 1) sum += model.weights[features[index]];
  return sigmoid(sum);
}

/**
 * AdaGrad over binary features, each class weighted so the rarer one counts
 * as much in total — real spending far outnumbers everything else.
 */
export function trainLogistic(examples: readonly Example[], options: TrainOptions = DEFAULT_TRAIN_OPTIONS): Trained {
  const weights = new Float64Array(options.buckets);
  const squares = new Float64Array(options.buckets);
  let bias = 0;
  let biasSquares = 0;
  const positives = examples.filter((example) => example.y === 1).length;
  const negatives = examples.length - positives;
  const classWeight = [
    negatives === 0 ? 1 : examples.length / (2 * negatives),
    positives === 0 ? 1 : examples.length / (2 * positives),
  ];
  const order = examples.map((_, index) => index);
  const random = mulberry32(options.seed);

  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [order[index], order[swap]] = [order[swap], order[index]];
    }
    for (const position of order) {
      const example = examples[position];
      const error = (predict({ weights, bias }, example.features) - example.y) * classWeight[example.y];
      biasSquares += error * error;
      bias -= (options.learningRate * error) / (Math.sqrt(biasSquares) + 1e-8);
      for (let index = 0; index < example.features.length; index += 1) {
        const feature = example.features[index];
        const gradient = error + options.l2 * weights[feature];
        squares[feature] += gradient * gradient;
        weights[feature] -= (options.learningRate * gradient) / (Math.sqrt(squares[feature]) + 1e-8);
      }
    }
  }
  return { weights, bias };
}

/** Weights as int8 behind one scale; the bias stays exact. */
export function quantise(model: Trained): { weights: string; scale: number; bias: number } {
  let largest = 0;
  for (const weight of model.weights) largest = Math.max(largest, Math.abs(weight));
  const scale = largest === 0 ? 1 : largest / 127;
  const bytes = new Int8Array(model.weights.length);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.round(model.weights[index] / scale);
  return {
    weights: encodeBase64(new Uint8Array(bytes.buffer)),
    scale: Number(scale.toPrecision(8)),
    bias: Number(model.bias.toPrecision(8)),
  };
}

/** Which of `k` folds a sender falls in, by its key, so all of its rows stay together. */
export const foldOf = (group: string, k: number): number => parseInt(hash53(`fold:${group}`).slice(-6), 16) % k;

export type Judged = {
  score: number;
  y: 0 | 1;
  /** Whether the model would be asked: a debit the rules called a transaction. */
  assessable: boolean;
};

export const DOUBT_FLOOR = 0.5;
export const DOUBT_CEILING = 0.99;

/**
 * The lowest threshold that demotes at most `maxDemotedRate` of the real
 * spending the model is asked about, among those that catch the most of what
 * must not count. Null when it would catch nothing held out: a model without
 * that evidence doubts nothing, and ships only to be measured.
 */
export function chooseThreshold(judged: readonly Judged[], maxDemotedRate: number): number | null {
  const asked = judged.filter((item) => item.assessable);
  const spending = asked.filter((item) => item.y === 0);
  const negatives = asked.filter((item) => item.y === 1);
  if (negatives.length === 0) return null;

  const candidates = [...new Set(negatives.map((item) => item.score))]
    .filter((score) => score >= DOUBT_FLOOR && score <= DOUBT_CEILING)
    .sort((a, b) => a - b);
  let best: number | null = null;
  let bestCaught = 0;
  for (const threshold of candidates) {
    const demoted = spending.filter((item) => item.score >= threshold).length;
    if (spending.length > 0 && demoted / spending.length > maxDemotedRate) continue;
    const caught = negatives.filter((item) => item.score >= threshold).length;
    if (caught > bestCaught) {
      best = threshold;
      bestCaught = caught;
    }
  }
  /* A hair under the score it was chosen at, so that example is caught and rounding never flips it. */
  return best === null ? null : Math.round(Math.max(DOUBT_FLOOR, best - 1e-6) * 1e6) / 1e6;
}

const ISSUERS = ['HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Bank', 'Yes Bank', 'Canara Bank', 'Federal Bank', 'IDFC FIRST Bank'];
const ISSUER_PATTERN = new RegExp(`\\b(?:${ISSUERS.map((name) => name.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');
const BALANCE_CLAUSE = /\s*\b(?:avl|available|avail|avlbl|closing|curr(?:ent)?)\.?\s*bal(?:ance)?\b(?:[^.\n]|\.(?=\d))*\.?/i;

/**
 * Training-only variants of a skeleton (D21): another bank's name in place of
 * one, and the balance clause dropped. Banks differ in exactly these ways, and
 * the corpus has more alerts from some banks than others. Never evaluated on.
 */
export function variantsOf(body: string, random: () => number): string[] {
  const variants: string[] = [];
  const named = ISSUER_PATTERN.exec(body);
  if (named !== null) {
    const others = ISSUERS.filter((name) => name.toLowerCase() !== named[0].toLowerCase().replace(/\s+/g, ' '));
    variants.push(body.replace(ISSUER_PATTERN, others[Math.floor(random() * others.length)]));
  }
  const trimmed = body.replace(BALANCE_CLAUSE, '');
  if (trimmed !== body && trimmed.trim() !== '') variants.push(trimmed);
  return variants;
}
