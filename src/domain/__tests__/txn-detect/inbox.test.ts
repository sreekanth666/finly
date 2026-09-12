import {
  canConfirmInOneTap,
  countsTowardBadge,
  redactCodes,
  sectionOf,
  sourceAppName,
  sourceTextOf,
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
