/**
 * Trains the detector's model (D21) on the training split of the corpus and
 * writes src/domain/txn-detect/model/weights.json.
 *
 * Deterministic: the same corpus gives the same file, byte for byte, and the
 * model's version only goes up when what it would say changes — which is what
 * makes the app read pending messages again. The evaluation split is scored
 * and printed, never used to choose anything.
 *
 * Run: pnpm train:detector
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { corpusHashOf, groupOf, senderKeyOf, splitOf, type CorpusRow } from '@/domain/txn-detect/model/corpus';
import { FEATURE_VERSION, featuresOf } from '@/domain/txn-detect/model/features';
import { describeMetrics, evaluate } from '@/domain/txn-detect/model/metrics';
import {
  chooseThreshold,
  DEFAULT_TRAIN_OPTIONS,
  foldOf,
  mulberry32,
  predict,
  quantise,
  trainLogistic,
  variantsOf,
  type Example,
  type Judged,
} from '@/domain/txn-detect/model/train';
import { decodeModel, type ModelFile } from '@/domain/txn-detect/model/weights-format';

import {
  loadCorpus,
  modelInputOfRow,
  readJson,
  rulesPlacement,
  scoreModel,
  scoreRules,
} from '../../src/domain/__tests__/fixtures/detector-corpus';

type Gate = { maxDemotedRate: number };

const OUT = join(process.cwd(), 'src', 'domain', 'txn-detect', 'model', 'weights.json');
const FOLDS = 5;
const ALPHA = 4;

const options = DEFAULT_TRAIN_OPTIONS;

function examplesOf(rows: readonly CorpusRow[], seed: number): { examples: Example[]; variants: number } {
  const random = mulberry32(seed);
  const examples: Example[] = [];
  let variants = 0;
  for (const row of rows) {
    const y = groupOf(row) === 'must_not_count' ? 1 : 0;
    const group = senderKeyOf(row);
    examples.push({ features: featuresOf(modelInputOfRow(row), options.buckets), y, group });
    for (const body of variantsOf(row.body, random)) {
      examples.push({ features: featuresOf(modelInputOfRow({ ...row, body }), options.buckets), y, group });
      variants += 1;
    }
  }
  return { examples, variants };
}

/** Grouped by sender: every fold's model is judged only on senders it never saw. */
function crossValidate(rows: readonly CorpusRow[]): Judged[] {
  const judged: Judged[] = [];
  for (let fold = 0; fold < FOLDS; fold += 1) {
    const held = rows.filter((row) => foldOf(senderKeyOf(row), FOLDS) === fold);
    if (held.length === 0) continue;
    const kept = rows.filter((row) => foldOf(senderKeyOf(row), FOLDS) !== fold);
    const model = trainLogistic(examplesOf(kept, options.seed + fold).examples, options);
    for (const row of held) {
      const placement = rulesPlacement(row);
      judged.push({
        score: predict(model, featuresOf(modelInputOfRow(row), options.buckets)),
        y: groupOf(row) === 'must_not_count' ? 1 : 0,
        assessable: placement.kind === 'transaction' && placement.section !== 'money_in',
      });
    }
  }
  return judged;
}

it('trains the detector model', () => {
  const corpus = loadCorpus();
  expect(corpus.problems).toEqual([]);
  const gate = readJson<Gate>('gate.json');

  const train = corpus.rows.filter((row) => splitOf(row) === 'train' && groupOf(row) !== 'ambiguous');
  const threshold = chooseThreshold(crossValidate(train), gate.maxDemotedRate);
  const { examples, variants } = examplesOf(train, options.seed);
  const packed = quantise(trainLogistic(examples, options));

  const previous = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as ModelFile) : null;
  const unchanged =
    previous !== null &&
    previous.weights === packed.weights &&
    previous.bias === packed.bias &&
    previous.scale === packed.scale &&
    previous.threshold.doubt === threshold &&
    previous.featureVersion === FEATURE_VERSION;

  const draft: ModelFile = {
    format: 1,
    version: previous === null ? 1 : unchanged ? previous.version : previous.version + 1,
    featureVersion: FEATURE_VERSION,
    buckets: options.buckets,
    bias: packed.bias,
    scale: packed.scale,
    weights: packed.weights,
    alpha: ALPHA,
    threshold: { doubt: threshold, filter: null },
    trainedOn: { corpusHash: corpusHashOf(train), rows: train.length, variants },
    metrics: {},
  };

  const model = decodeModel(draft);
  const evalRules = evaluate(scoreRules(corpus.rows, 'eval'));
  const evalModel = evaluate(scoreModel(corpus.rows, model, 'eval'));
  draft.metrics = {
    evalRows: evalModel.rows,
    evalLost: evalModel.lost.length,
    evalReviewPrecision: Math.round(evalModel.reviewPrecision * 1e4) / 1e4,
    evalFalsePositiveRate: Math.round(evalModel.falsePositiveRate * 1e4) / 1e4,
    evalDemoted: evalModel.demoted.length,
  };

  const text = `${JSON.stringify(draft, null, 2)}\n`;
  writeFileSync(OUT, text);
  console.log(
    [
      `Model ${draft.version}${unchanged ? ' (unchanged)' : ''}: ${train.length} rows + ${variants} variants, doubt at ${threshold}, ${text.length} bytes`,
      describeMetrics('eval, rules', evalRules),
      describeMetrics('eval, rules + model', evalModel),
      describeMetrics('every row, rules + model', evaluate(scoreModel(corpus.rows, model))),
    ].join('\n\n'),
  );
});
