import { labelledShapeOf, truthOf, verdictOf, type ReviewedMessage } from '@/domain/support/labelled';

const message = (overrides: Partial<ReviewedMessage> = {}): ReviewedMessage => ({
  body: 'Rs.720.00 debited from A/c XX1234 to RAHUL MENON on 02-Sep-26',
  sender: 'JD-HDFCBK-T',
  title: null,
  packageName: 'com.google.android.apps.messaging',
  kind: 'transaction',
  status: 'confirmed',
  cardPaymentId: null,
  ...overrides,
});

describe('verdictOf', () => {
  it('reads what the user did from where the candidate ended up', () => {
    expect(verdictOf({ status: 'confirmed', cardPaymentId: null })).toBe('spent');
    expect(verdictOf({ status: 'confirmed', cardPaymentId: 'cp-1' })).toBe('card_payment');
    expect(verdictOf({ status: 'settled', cardPaymentId: null })).toBe('settled');
    expect(verdictOf({ status: 'not_transaction', cardPaymentId: null })).toBe('not_payment');
    expect(verdictOf({ status: 'dismissed', cardPaymentId: null })).toBe('dismissed');
    expect(verdictOf({ status: 'pending', cardPaymentId: null })).toBe('pending');
  });

  it('says nothing for a duplicate, a second copy of something already counted', () => {
    expect(verdictOf({ status: 'duplicate', cardPaymentId: null })).toBeNull();
  });
});

describe('truthOf', () => {
  it('makes a confirmation spending, whatever it was read as', () => {
    expect(truthOf('spent', 'promo')).toEqual({ kind: 'transaction' });
    expect(truthOf('settled', 'transaction')).toEqual({ kind: 'refund' });
    expect(truthOf('card_payment', 'transfer')).toEqual({ kind: 'transfer' });
  });

  it('keeps a filed reading the user agreed with, and otherwise only says it must not count', () => {
    expect(truthOf('not_payment', 'promo')).toEqual({ kind: 'promo' });
    expect(truthOf('not_payment', 'transaction')).toEqual({ kind: 'unknown', group: 'must_not_count' });
    expect(truthOf('not_payment', 'unknown')).toEqual({ kind: 'unknown', group: 'must_not_count' });
  });

  it('never turns a discard into a negative example', () => {
    expect(truthOf('dismissed', 'transaction')).toBeNull();
    expect(truthOf('pending', 'transaction')).toBeNull();
  });
});

describe('labelledShapeOf', () => {
  it('sends the shape and the verdict, and nothing personal', () => {
    const shape = labelledShapeOf(message())!;
    expect(shape).toEqual({
      sender: 'JD-HDFCBK-T',
      packageName: 'com.google.android.apps.messaging',
      read: 'transaction',
      verdict: 'spent',
      truth: { kind: 'transaction' },
      skeleton: 'Rs.9.99 debited from A/c XX9999 to AA AA on 02-Sep-26',
    });
    expect(JSON.stringify(shape)).not.toMatch(/rahul|menon|720|1234/i);
  });

  it('takes a sender id from the title, but never a contact name', () => {
    expect(labelledShapeOf(message({ sender: null, title: 'AX-SBIUPI-S' }))!.sender).toBe('AX-SBIUPI-S');
    expect(labelledShapeOf(message({ sender: null, title: 'Mom' }))!.sender).toBeNull();
    expect(labelledShapeOf(message({ sender: 'Suresh' }))!.sender).toBeNull();
    expect(labelledShapeOf(message({ sender: null, title: 'Anjali' }))!.sender).toBeNull();
    expect(labelledShapeOf(message({ sender: '+919876543210' }))!.sender).toBeNull();
  });

  it('names the app that posted it, SMS app included, as the phone’s model sees it', () => {
    expect(labelledShapeOf(message({ sender: null, packageName: 'com.phonepe.app' }))!.packageName).toBe('com.phonepe.app');
    expect(labelledShapeOf(message())!.packageName).toBe('com.google.android.apps.messaging');
  });

  it('leaves a duplicate out', () => {
    expect(labelledShapeOf(message({ status: 'duplicate' }))).toBeNull();
  });
});
