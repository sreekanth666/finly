import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { detect } from '@/domain/txn-detect';
import { assess, isAssessable, shippedModel } from '@/domain/txn-detect/model/assess';
import { corpusHashOf, groupOf, splitOf } from '@/domain/txn-detect/model/corpus';
import { FEATURE_VERSION } from '@/domain/txn-detect/model/features';
import { describeMetrics, evaluate } from '@/domain/txn-detect/model/metrics';
import type { ModelFile } from '@/domain/txn-detect/model/weights-format';

import { loadCorpus, READ_AT, readJson, scoreModel, scoreRules } from '../fixtures/detector-corpus';

/**
 * The gate every change to the detector passes (D21). The rules must lose no
 * money that moved; the shipped model must have been trained on this corpus
 * with these features, may not cost real spending more than its budget of
 * demotions on senders it never saw, and must be small and fast. The rest is
 * printed when asked: `pnpm detector:eval`.
 */

type Gate = { knownMisses: string[]; maxDemotedRate: number; maxModelBytes: number; maxMeanAssessMs: number };

const MODEL_PATH = join(process.cwd(), 'src', 'domain', 'txn-detect', 'model', 'weights.json');

const corpus = loadCorpus();
const gate = readJson<Gate>('gate.json');

describe('the detector corpus', () => {
  it('is well formed, and holds nothing but skeletons', () => {
    expect(corpus.problems).toEqual([]);
  });

  it('has senders on both sides of the split', () => {
    const splits = new Set(corpus.rows.map(splitOf));
    expect([...splits].sort()).toEqual(['eval', 'train']);
  });
});

describe('the rules, read against the corpus', () => {
  const metrics = evaluate(scoreRules(corpus.rows));

  it('lose no money that moved, beyond the misses on record', () => {
    const known = new Set(gate.knownMisses);
    expect(metrics.lost.filter((id) => !known.has(id))).toEqual([]);
  });

  it('still miss every miss on record, so the record never outlives a fix', () => {
    expect(gate.knownMisses.filter((id) => !metrics.lost.includes(id))).toEqual([]);
  });
});

describe('the shipped model', () => {
  const text = readFileSync(MODEL_PATH, 'utf8');
  const file = JSON.parse(text) as ModelFile;
  const model = shippedModel();
  const train = corpus.rows.filter((row) => splitOf(row) === 'train' && groupOf(row) !== 'ambiguous');

  it('was trained on this corpus, with these features — or run pnpm train:detector', () => {
    expect(file.featureVersion).toBe(FEATURE_VERSION);
    expect(file.trainedOn.corpusHash).toBe(corpusHashOf(train));
  });

  it('demotes no more real spending than its budget, on senders it never saw', () => {
    const withModel = evaluate(scoreModel(corpus.rows, model, 'eval'));
    const spendingInReview = evaluate(scoreRules(corpus.rows, 'eval')).reviewSpending;
    expect(withModel.demoted.length).toBeLessThanOrEqual(Math.floor(gate.maxDemotedRate * spendingInReview));
  });

  it('never loses money that moved, and never adds to the badge', () => {
    const rules = evaluate(scoreRules(corpus.rows));
    const withModel = evaluate(scoreModel(corpus.rows, model));
    expect(withModel.lost).toEqual(rules.lost);
    expect(withModel.falsePositives.length).toBeLessThanOrEqual(rules.falsePositives.length);
    expect(withModel.reviewPrecision).toBeGreaterThanOrEqual(rules.reviewPrecision);
  });

  it('is small enough to ship and fast enough to run on every payment', () => {
    expect(text.length).toBeLessThanOrEqual(gate.maxModelBytes);
    const messages = corpus.rows.map((row) => ({
      input: { body: row.body, sender: row.sender, title: row.title, packageName: row.packageName, receivedAt: READ_AT },
    }));
    const readings = messages
      .map(({ input }) => ({ input, detection: detect(input) }))
      .filter(({ detection }) => isAssessable(detection));
    expect(readings.length).toBeGreaterThan(0);
    /* The best of several batches: a busy machine only ever makes a batch slower. */
    const batch = (): number => {
      const started = performance.now();
      for (let round = 0; round < 10; round += 1) {
        for (const { input, detection } of readings) assess(input, detection, model);
      }
      return (performance.now() - started) / (10 * readings.length);
    };
    batch();
    const best = Math.min(...Array.from({ length: 5 }, batch));
    expect(best).toBeLessThanOrEqual(gate.maxMeanAssessMs);
  });
});

if (process.env.DETECTOR_REPORT !== undefined) {
  it('report', () => {
    const model = shippedModel();
    console.log(
      [
        `Model ${model.version}, doubt at ${model.threshold.doubt ?? 'none (doubts nothing)'}`,
        describeMetrics('rules, every row', evaluate(scoreRules(corpus.rows))),
        describeMetrics('rules, eval', evaluate(scoreRules(corpus.rows, 'eval'))),
        describeMetrics('rules + model, eval', evaluate(scoreModel(corpus.rows, model, 'eval'))),
        describeMetrics('rules + model, every row', evaluate(scoreModel(corpus.rows, model))),
      ].join('\n\n'),
    );
  });
}
