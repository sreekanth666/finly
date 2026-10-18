import { describeMetrics, evaluate } from '@/domain/txn-detect/model/metrics';
import { splitOf } from '@/domain/txn-detect/model/corpus';

import { loadCorpus, readJson, scoreRules } from '../fixtures/detector-corpus';

/**
 * The gate every change to the detector passes (D21). Today it holds the rules
 * to one promise — no money that moved is read as something else — and prints
 * the rest when asked: `pnpm detector:eval`.
 */

type Gate = { knownMisses: string[] };

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

  if (process.env.DETECTOR_REPORT !== undefined) {
    it('report', () => {
      console.log(
        [
          describeMetrics('rules, every row', metrics),
          describeMetrics('rules, train', evaluate(scoreRules(corpus.rows, 'train'))),
          describeMetrics('rules, eval', evaluate(scoreRules(corpus.rows, 'eval'))),
        ].join('\n\n'),
      );
    });
  }
});
