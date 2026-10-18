import { isAssessable, labelKeyOf } from '@/domain/txn-detect/model/assess';
import { isDoubtful, nextCounts, personalised } from '@/domain/txn-detect/model/doubt';
import { bucketOf, featureNamesOf, featuresOf, type ModelInput } from '@/domain/txn-detect/model/features';
import {
  chooseThreshold,
  foldOf,
  mulberry32,
  predict,
  quantise,
  trainLogistic,
  variantsOf,
  type Example,
} from '@/domain/txn-detect/model/train';
import { decodeBase64, decodeModel, encodeBase64, scoreOf, type ModelFile } from '@/domain/txn-detect/model/weights-format';

const BUCKETS = 1024;
const input = (skeleton: string, overrides: Partial<ModelInput> = {}): ModelInput => ({
  skeleton,
  sender: 'JD-HDFCBK-T',
  title: null,
  packageName: 'com.google.android.apps.messaging',
  ...overrides,
});

describe('featuresOf', () => {
  it('touches exactly the buckets of the features it names, sorted and once each', () => {
    const message = input('Rs.9.99 debited from A/c XX9999 to AA AA on 02-Sep-26');
    const named = new Set(featureNamesOf(message).map((name) => bucketOf(name, BUCKETS)));
    const hashed = featuresOf(message, BUCKETS);
    expect([...hashed]).toEqual([...named].sort((a, b) => a - b));
    expect(featuresOf(message, BUCKETS)).toEqual(hashed);
  });

  it('sees the words, the shapes, the sender and the gates, not only the characters', () => {
    const names = featureNamesOf(input('Get flat Rs 9 off! Paid Rs 9 or more?', { sender: 'VK-SBIUPI-P', packageName: 'com.phonepe.app' }));
    expect(names).toEqual(
      expect.arrayContaining(['w:flat', 'b:get flat', 's:sfx:P', 's:via:app', 's:pkg:com.phonepe.app', 's:gate:leading-promo', 'c:fla']),
    );
    expect(featureNamesOf(input('Paid to AA Aa'))).toEqual(expect.arrayContaining(['w:#AA', 'w:#Aa']));
  });
});

describe('the model file', () => {
  it('round-trips bytes through base64', () => {
    const bytes = Uint8Array.from([0, 1, 127, 128, 200, 255, 7]);
    for (let length = 0; length <= bytes.length; length += 1) {
      expect(decodeBase64(encodeBase64(bytes.slice(0, length)))).toEqual(bytes.slice(0, length));
    }
  });

  it('scores with the int8 weights it decodes, and refuses a file that does not add up', () => {
    const weights = new Int8Array(8);
    weights[3] = 100;
    const file: ModelFile = {
      format: 1,
      version: 1,
      featureVersion: 1,
      buckets: 8,
      bias: 0,
      scale: 0.01,
      weights: encodeBase64(new Uint8Array(weights.buffer)),
      alpha: 4,
      threshold: { doubt: 0.7, filter: null },
      trainedOn: { corpusHash: 'x', rows: 0, variants: 0 },
      metrics: {},
    };
    const model = decodeModel(file);
    expect(scoreOf(model, Uint32Array.from([3]))).toBeCloseTo(1 / (1 + Math.exp(-1)));
    expect(scoreOf(model, Uint32Array.from([]))).toBe(0.5);
    expect(() => decodeModel({ ...file, buckets: 16 })).toThrow('8 weights for 16 buckets');
  });
});

describe('training', () => {
  const examples = (): Example[] => {
    const offers = ['Get flat Rs 9 off now', 'Shop now and win Rs 9', 'Apply now for a loan of Rs 9'];
    const alerts = ['Rs 9.99 debited from A/c XX9999', 'Rs 9 spent on Card XX9999 at AA', 'INR 9.99 debited via UPI to aa@aa'];
    return [
      ...offers.map((text, index) => ({ features: featuresOf(input(text), BUCKETS), y: 1 as const, group: `o${index}` })),
      ...alerts.map((text, index) => ({ features: featuresOf(input(text), BUCKETS), y: 0 as const, group: `a${index}` })),
    ];
  };
  const options = { buckets: BUCKETS, epochs: 30, learningRate: 0.2, l2: 1e-3, seed: 7 };

  it('learns to tell an offer from an alert', () => {
    const model = trainLogistic(examples(), options);
    expect(predict(model, featuresOf(input('Get flat Rs 9 off on recharges'), BUCKETS))).toBeGreaterThan(0.5);
    expect(predict(model, featuresOf(input('Rs 9.99 debited from A/c XX9999 to AA'), BUCKETS))).toBeLessThan(0.5);
  });

  it('gives the same model from the same data, byte for byte', () => {
    expect(quantise(trainLogistic(examples(), options))).toEqual(quantise(trainLogistic(examples(), options)));
  });

  it('keeps what a model says through quantising', () => {
    const model = trainLogistic(examples(), options);
    const packed = quantise(model);
    const shipped = decodeModel({
      format: 1,
      version: 1,
      featureVersion: 1,
      buckets: BUCKETS,
      bias: packed.bias,
      scale: packed.scale,
      weights: packed.weights,
      alpha: 4,
      threshold: { doubt: null, filter: null },
      trainedOn: { corpusHash: 'x', rows: 6, variants: 0 },
      metrics: {},
    });
    for (const example of examples()) {
      expect(scoreOf(shipped, example.features)).toBeCloseTo(predict(model, example.features), 1);
    }
  });

  it('shuffles the same way everywhere, and keeps a sender in one fold', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(foldOf('HDFCBK', 5)).toBe(foldOf('HDFCBK', 5));
  });

  it('makes variants a bank might send, and none of a message with nothing to vary', () => {
    const variants = variantsOf('INR 9.99 debited from HDFC Bank A/c XX9999. Avl Bal INR 9.99', mulberry32(1));
    expect(variants).toHaveLength(2);
    expect(variants[0]).not.toContain('HDFC Bank');
    expect(variants[1]).toBe('INR 9.99 debited from HDFC Bank A/c XX9999.');
    expect(variantsOf('Aa sent you INR 9', mulberry32(1))).toEqual([]);
  });
});

describe('chooseThreshold', () => {
  const spend = (score: number) => ({ score, y: 0 as const, assessable: true });
  const offer = (score: number) => ({ score, y: 1 as const, assessable: true });

  it('catches the most it can within the budget of demoted spending', () => {
    const judged = [...Array.from({ length: 50 }, () => spend(0.1)), spend(0.8), offer(0.9), offer(0.85), offer(0.6)];
    expect(chooseThreshold(judged, 0.02)).toBeCloseTo(0.6, 4);
    expect(chooseThreshold(judged, 0)).toBeCloseTo(0.85, 4);
  });

  it('doubts nothing without evidence, and never below the floor', () => {
    expect(chooseThreshold([spend(0.1), { score: 0.9, y: 1, assessable: false }], 0.02)).toBeNull();
    expect(chooseThreshold([spend(0.1), offer(0.3)], 0.02)).toBeNull();
    expect(chooseThreshold([spend(0.1), offer(0.995)], 0.02)).toBeNull();
  });
});

describe('personalised doubt', () => {
  const model = { alpha: 4, threshold: { doubt: 0.7, filter: null } };

  it('is the model alone until the user has said something about the sender', () => {
    expect(personalised(0.8, undefined, 4)).toBe(0.8);
    expect(personalised(0.8, { confirmed: 0, notTransaction: 0 }, 4)).toBeCloseTo(0.8);
  });

  it('moves toward what the user said, one label never deciding on its own', () => {
    expect(isDoubtful(0.8, undefined, model)).toBe(true);
    expect(isDoubtful(0.8, { confirmed: 1, notTransaction: 0 }, model)).toBe(false);
    expect(isDoubtful(0.5, { confirmed: 0, notTransaction: 1 }, model)).toBe(false);
    expect(isDoubtful(0.5, { confirmed: 0, notTransaction: 4 }, model)).toBe(true);
  });

  it('never doubts with a model that has no threshold', () => {
    expect(isDoubtful(1, { confirmed: 0, notTransaction: 100 }, { alpha: 4, threshold: { doubt: null, filter: null } })).toBe(false);
  });
});

describe('what the model is asked, and whose labels count', () => {
  it('asks only about debits the rules read as payments, and never about a taught format', () => {
    expect(isAssessable({ kind: 'transaction', direction: 'debit', reasons: [] })).toBe(true);
    expect(isAssessable({ kind: 'transaction', direction: null, reasons: [] })).toBe(true);
    expect(isAssessable({ kind: 'transaction', direction: 'credit', reasons: [] })).toBe(false);
    expect(isAssessable({ kind: 'promo', direction: 'debit', reasons: [] })).toBe(false);
    expect(isAssessable({ kind: 'transaction', direction: 'debit', reasons: ['template:t1'] })).toBe(false);
  });

  it('keeps a bank’s promotions apart from its alerts, and never keys by a person', () => {
    expect(labelKeyOf({ sender: 'JD-HDFCBK-T' })).toBe('HDFCBK-T');
    expect(labelKeyOf({ sender: 'VM-HDFCBK-P' })).toBe('HDFCBK-P');
    expect(labelKeyOf({ sender: 'AD-ATMSBI' })).toBe('ATMSBI');
    expect(labelKeyOf({ sender: null, packageName: 'com.phonepe.app' })).toBe('com.phonepe.app');
    expect(labelKeyOf({ sender: null, title: 'Mom', packageName: 'com.google.android.apps.messaging' })).toBeNull();
  });
});

describe('nextCounts', () => {
  it('counts a label and takes it back, never below zero', () => {
    expect(nextCounts({ confirmed: 2, notTransaction: 1 }, 'confirmed', 1)).toEqual({ confirmed: 3, notTransaction: 1 });
    expect(nextCounts({ confirmed: 0, notTransaction: 1 }, 'confirmed', -1)).toEqual({ confirmed: 0, notTransaction: 1 });
  });

  it('starts a forgotten sender from nothing', () => {
    expect(nextCounts(null, 'notTransaction', 1)).toEqual({ confirmed: 0, notTransaction: 1 });
    expect(nextCounts(null, 'confirmed', -1)).toEqual({ confirmed: 0, notTransaction: 0 });
  });
});
