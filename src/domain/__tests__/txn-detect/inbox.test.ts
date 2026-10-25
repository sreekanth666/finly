import {
  batchPrompt,
  canAddInBatch,
  canConfirmInOneTap,
  countsTowardBadge,
  redactCodes,
  sectionOf,
  sourceAppName,
  sourceTextOf,
  splitForAdd,
} from '@/domain/txn-detect';

describe('sectionOf', () => {
  it('puts a well-read debit in Needs review and an unsure one in Maybe', () => {
    expect(sectionOf({ kind: 'transaction', direction: 'debit', confidence: 'high' })).toBe('review');
    expect(sectionOf({ kind: 'transaction', direction: 'debit', confidence: 'medium' })).toBe('review');
    expect(sectionOf({ kind: 'transaction', direction: 'debit', confidence: 'low' })).toBe('maybe');
    expect(sectionOf({ kind: 'unknown', direction: null, confidence: 'low' })).toBe('maybe');
  });

  it('puts credits and refunds in Money in', () => {
    expect(sectionOf({ kind: 'transaction', direction: 'credit', confidence: 'high' })).toBe('money_in');
    expect(sectionOf({ kind: 'refund', direction: 'credit', confidence: 'medium' })).toBe('money_in');
  });

  it('files everything that is not spending, transfers included', () => {
    for (const kind of ['transfer', 'otp', 'promo', 'statement', 'reminder', 'failed', 'upcoming', 'balance'] as const) {
      expect(sectionOf({ kind, direction: 'debit', confidence: 'high' })).toBe('filtered');
    }
  });
});

describe('a message that shows no sign of money (D21)', () => {
  it('is filed, whatever else is unsure about it, and leaves the badge', () => {
    const filed = { kind: 'unknown' as const, direction: null, confidence: 'low' as const, filed: true };
    expect(sectionOf(filed)).toBe('filtered');
    expect(countsTowardBadge(filed)).toBe(false);
    expect(sectionOf({ ...filed, filed: false })).toBe('maybe');
  });
});

describe('countsTowardBadge', () => {
  it('counts only what might be spending', () => {
    expect(countsTowardBadge({ kind: 'transaction', direction: 'debit', confidence: 'high' })).toBe(true);
    expect(countsTowardBadge({ kind: 'unknown', direction: null, confidence: 'low' })).toBe(true);
    expect(countsTowardBadge({ kind: 'transaction', direction: 'credit', confidence: 'high' })).toBe(false);
    expect(countsTowardBadge({ kind: 'promo', direction: null, confidence: 'medium' })).toBe(false);
  });
});

describe('canConfirmInOneTap', () => {
  const base = { kind: 'transaction' as const, confidence: 'high' as const, amountMinor: 500, currency: 'INR' };

  it('allows a sure rupee payment', () => {
    expect(canConfirmInOneTap(base)).toBe(true);
  });

  it('refuses anything that needs a look: unsure, foreign, amountless, or not a payment', () => {
    expect(canConfirmInOneTap({ ...base, confidence: 'medium' })).toBe(false);
    expect(canConfirmInOneTap({ ...base, currency: 'USD' })).toBe(false);
    expect(canConfirmInOneTap({ ...base, amountMinor: null })).toBe(false);
    expect(canConfirmInOneTap({ ...base, kind: 'transfer' })).toBe(false);
  });
});

describe('canAddInBatch', () => {
  const base = {
    kind: 'transaction' as const,
    direction: 'debit' as const,
    confidence: 'high' as const,
    amountMinor: 500,
    currency: 'INR',
  };

  it('takes a sure rupee payment from Needs review', () => {
    expect(canAddInBatch(base)).toBe(true);
  });

  it('never takes a credit, even one read with confidence', () => {
    const credit = { ...base, direction: 'credit' as const };
    expect(canConfirmInOneTap(credit)).toBe(true);
    expect(canAddInBatch(credit)).toBe(false);
  });

  it('leaves Maybe, Filtered, foreign and amountless items for a look', () => {
    expect(canAddInBatch({ ...base, confidence: 'low' })).toBe(false);
    expect(canAddInBatch({ ...base, kind: 'unknown' })).toBe(false);
    expect(canAddInBatch({ ...base, kind: 'transfer' })).toBe(false);
    expect(canAddInBatch({ ...base, currency: 'USD' })).toBe(false);
    expect(canAddInBatch({ ...base, amountMinor: null })).toBe(false);
    expect(canAddInBatch({ ...base, confidence: 'medium' })).toBe(false);
  });

  it('follows the app currency', () => {
    expect(canAddInBatch({ ...base, currency: 'USD' }, 'USD')).toBe(true);
  });
});

describe('splitForAdd', () => {
  it('keeps order on both sides', () => {
    const sure = { kind: 'transaction' as const, direction: 'debit' as const, confidence: 'high' as const, amountMinor: 1, currency: 'INR' };
    const items = [
      { ...sure, id: 'a' },
      { ...sure, id: 'b', amountMinor: null },
      { ...sure, id: 'c' },
      { ...sure, id: 'd', direction: 'credit' as const },
    ];
    const { addable, skipped } = splitForAdd(items);
    expect(addable.map((item) => item.id)).toEqual(['a', 'c']);
    expect(skipped.map((item) => item.id)).toEqual(['b', 'd']);
  });

  it('splits nothing into nothing', () => {
    expect(splitForAdd([])).toEqual({ addable: [], skipped: [] });
  });
});

describe('batchPrompt', () => {
  it('counts what an add takes and what it leaves', () => {
    expect(batchPrompt('add', 12, 3)).toEqual({
      title: 'Add 12 payments?',
      message: '3 others need a look and will stay in Review.',
      confirmLabel: 'Add',
      destructive: false,
    });
    expect(batchPrompt('add', 1, 1).title).toBe('Add 1 payment?');
    expect(batchPrompt('add', 1, 1).message).toBe('1 other needs a look and will stay in Review.');
    expect(batchPrompt('add', 4).message).toBe('Each is added as read, with its suggested category and account.');
  });

  it('marks a discard as destructive and names a filtered one', () => {
    expect(batchPrompt('discard', 8)).toMatchObject({ title: 'Discard 8 items?', confirmLabel: 'Discard', destructive: true });
    expect(batchPrompt('discard', 1).title).toBe('Discard 1 item?');
    expect(batchPrompt('discard_filtered', 5).title).toBe('Discard 5 filtered items?');
  });
});

describe('sourceTextOf', () => {
  it('keeps the message verbatim under one line of where and when', () => {
    const text = sourceTextOf({
      source: 'notification',
      packageName: 'com.google.android.apps.messaging',
      sender: 'VM-HDFCBK',
      title: null,
      body: '  Sent Rs.500.00\nFrom HDFC Bank A/C *6630 ',
      receivedAt: new Date(2026, 8, 10, 9, 45).getTime(),
    });
    expect(text).toBe('VM-HDFCBK · SMS · Thu, 10 Sep 2026 09:45\nSent Rs.500.00\nFrom HDFC Bank A/C *6630');
  });

  it('says a pasted message was pasted', () => {
    expect(sourceAppName('paste', null)).toBe('Pasted');
    expect(sourceAppName('notification', 'com.phonepe.app')).toBe('PhonePe');
    expect(sourceAppName('notification', 'com.example.bank')).toBe('com.example.bank');
  });
});

describe('redactCodes', () => {
  it('removes a code and leaves the amount', () => {
    expect(redactCodes('123456 is your OTP for txn of INR 2,450.00')).toBe('•••• is your OTP for txn of INR 2,450.00');
  });

  it('leaves a four-digit amount alone', () => {
    expect(redactCodes('OTP 4821 for Rs.5000 or INR 5000.00')).toBe('OTP •••• for Rs.5000 or INR 5000.00');
  });
});
