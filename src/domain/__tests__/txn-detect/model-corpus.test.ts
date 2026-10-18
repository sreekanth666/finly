import {
  groupOf,
  parseCorpus,
  senderKeyOf,
  serialiseCorpus,
  splitOf,
  templateKeyOf,
  type CorpusRow,
} from '@/domain/txn-detect/model/corpus';
import { evaluate, type Scored } from '@/domain/txn-detect/model/metrics';
import { senderHeader, senderSuffix } from '@/domain/txn-detect/sources';

const row = (overrides: Partial<CorpusRow> = {}): CorpusRow => ({
  id: 'r1',
  body: 'Rs 9.99 debited from A/c XX9999 to AA AA',
  sender: 'JD-HDFCBK-T',
  title: null,
  packageName: null,
  kind: 'transaction',
  source: 'report',
  ...overrides,
});

const lines = (...values: unknown[]): string => values.map((value) => JSON.stringify(value)).join('\n');

describe('senderSuffix', () => {
  it('reads what the TRAI suffix registered the message as', () => {
    expect(senderSuffix('JD-HDFCBK-P')).toBe('P');
    expect(senderSuffix('vm-sbiupi-t')).toBe('T');
    expect(senderSuffix('AD-ATMSBI')).toBeNull();
    expect(senderSuffix('HDFC Bank')).toBeNull();
    expect(senderSuffix(null)).toBeNull();
  });

  it('leaves the header template binding depends on as it was', () => {
    expect(senderHeader('JD-HDFCBK-P')).toBe('HDFCBK');
  });
});

describe('parseCorpus', () => {
  it('reads rows and skips blank lines', () => {
    const parsed = parseCorpus(`${lines(row(), row({ id: 'r2' }))}\n\n`);
    expect(parsed.problems).toEqual([]);
    expect(parsed.rows.map((item) => item.id)).toEqual(['r1', 'r2']);
  });

  it('refuses a body that still holds what a skeleton removes', () => {
    const parsed = parseCorpus(lines(row({ body: 'Rs 720.00 debited to RAHUL MENON' })));
    expect(parsed.problems).toEqual(['line 1: body is not a skeleton']);
  });

  it('refuses a title that is a name, and a sender that is a phone number', () => {
    expect(parseCorpus(lines(row({ title: 'Rahul' }))).problems).toEqual(['line 1: title is not a skeleton']);
    expect(parseCorpus(lines(row({ sender: '+919876543210' }))).problems).toEqual([
      'line 1: sender is not a DLT sender id',
    ]);
  });

  it('names every other problem by its line', () => {
    const parsed = parseCorpus(
      [
        'not json',
        JSON.stringify({ ...row({ id: 'a' }), extra: 1 }),
        JSON.stringify(row({ id: 'b', kind: 'spending' as never })),
        JSON.stringify(row({ id: 'c', source: 'public:unlisted' })),
        JSON.stringify(row({ id: 'd', source: 'synthetic' })),
        JSON.stringify(row({ id: 'e' })),
        JSON.stringify(row({ id: 'e' })),
      ].join('\n'),
    );
    expect(parsed.problems).toEqual([
      'line 1: not JSON',
      'line 2: unknown field extra',
      'line 3: unknown kind spending',
      'line 4: unknown source public:unlisted',
      'line 5: a synthetic row names its parent',
      'line 7: duplicate id e',
    ]);
  });

  it('accepts a public dataset only once it is listed, and a variant only of a row it can find', () => {
    expect(parseCorpus(lines(row({ source: 'public:uci-sms' })), new Set(['uci-sms'])).problems).toEqual([]);
    expect(parseCorpus(lines(row({ id: 'v', source: 'synthetic', parent: 'gone' }))).problems).toEqual([
      'v: parent gone is not in the corpus',
    ]);
  });

  it('writes rows back in id order, one per line', () => {
    const text = serialiseCorpus([row({ id: 'b' }), row({ id: 'a' })]);
    expect(parseCorpus(text).rows.map((item) => item.id)).toEqual(['a', 'b']);
    expect(text.endsWith('\n')).toBe(true);
  });
});

describe('what a row is, derived', () => {
  it('groups by the verdict, unless the row says otherwise', () => {
    expect(groupOf({ kind: 'transfer' })).toBe('must_capture');
    expect(groupOf({ kind: 'promo' })).toBe('must_not_count');
    expect(groupOf({ kind: 'unknown' })).toBe('ambiguous');
    expect(groupOf({ kind: 'unknown', group: 'must_not_count' })).toBe('must_not_count');
  });

  it('knows a sender by its header, then its app, then where it came from', () => {
    expect(senderKeyOf(row())).toBe('HDFCBK');
    expect(senderKeyOf(row({ sender: null, packageName: 'com.phonepe.app' }))).toBe('com.phonepe.app');
    expect(senderKeyOf(row({ sender: null, packageName: 'com.google.android.apps.messaging' }))).toBe('sms');
    expect(senderKeyOf(row({ sender: null }))).toBe('paste');
  });

  it('keeps a sender on one side of the split, whatever its suffix', () => {
    expect(splitOf(row({ sender: 'JD-HDFCBK-T' }))).toBe(splitOf(row({ sender: 'VM-HDFCBK-P', id: 'other' })));
  });

  it('only ever trains on made-up and borrowed text', () => {
    for (const sender of ['JD-HDFCBK-T', 'JD-ICICIT-S', 'AD-SBIUPI', 'VM-AXISBK-S', 'JD-KOTAKB-T', 'AD-FEDBNK-S']) {
      expect(splitOf(row({ sender, source: 'synthetic', parent: 'r1' }))).toBe('train');
      expect(splitOf(row({ sender, source: 'public:x' }))).toBe('train');
    }
  });

  it('calls two rows that differ only in their figures one template', () => {
    expect(templateKeyOf('Rs 9 debited, Ref 999999')).toBe(templateKeyOf('RS 9.99 debited, ref 99999999'));
    expect(templateKeyOf('Rs 9 debited')).not.toBe(templateKeyOf('Rs 9 credited'));
  });
});

describe('evaluate', () => {
  const scored = (id: string, truth: Scored['truth'], kind: Scored['truth'], section: Scored['placed']['section'], extra: Partial<Scored> = {}): Scored => ({
    id,
    senderKey: 'HDFCBK',
    truth,
    group: groupOf({ kind: truth }),
    placed: { kind, section },
    ...extra,
  });

  it('counts what was lost, what crowded the badge, and how much of Needs review is spending', () => {
    const metrics = evaluate([
      scored('paid', 'transaction', 'transaction', 'review'),
      scored('missed', 'transaction', 'promo', 'filtered'),
      scored('offer', 'promo', 'transaction', 'review'),
      scored('otp', 'otp', 'otp', 'filtered'),
      scored('notice', 'balance', 'unknown', 'maybe'),
      scored('unsure', 'unknown', 'transaction', 'review'),
    ]);
    expect(metrics.lost).toEqual(['missed']);
    expect(metrics.falsePositives).toEqual(['offer', 'notice']);
    expect(metrics.falsePositiveRate).toBeCloseTo(2 / 3);
    expect(metrics.reviewPrecision).toBe(0.5);
    expect(metrics.spendingKept).toBe(1);
    expect(metrics.ambiguous).toBe(1);
    expect(metrics.bySender.HDFCBK).toEqual({ rows: 6, lost: 1, falsePositives: 2 });
  });

  it('counts spending moved out of Needs review as demoted, against where the rules put it', () => {
    const metrics = evaluate([
      scored('a', 'transaction', 'transaction', 'maybe', { baseline: { kind: 'transaction', section: 'review' } }),
      scored('b', 'transaction', 'transaction', 'maybe', { baseline: { kind: 'transaction', section: 'maybe' } }),
    ]);
    expect(metrics.demoted).toEqual(['a']);
  });

  it('calls an empty Needs review precise, and no negatives no false positives', () => {
    const metrics = evaluate([]);
    expect(metrics.reviewPrecision).toBe(1);
    expect(metrics.falsePositiveRate).toBe(0);
  });
});
