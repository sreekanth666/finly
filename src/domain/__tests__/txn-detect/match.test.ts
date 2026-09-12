import { asMinor, rupees } from '@/domain/money';
import type { Rule } from '@/domain/rules';
import {
  bodyKeyOf,
  captureKey,
  categoryNameFor,
  detect,
  looksLikeManual,
  maskMessage,
  matchAccount,
  sameTransaction,
  suggest,
  tailsMatch,
  type DuplicateFacts,
} from '@/domain/txn-detect';

const at = (year: number, month1: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month1 - 1, day, hour, minute).getTime();

describe('tailsMatch', () => {
  it('matches a three-digit printed tail against a four-digit saved one', () => {
    expect(tailsMatch('0316', 'XX316')).toBe(true);
    expect(tailsMatch('11005', '1005')).toBe(true);
  });

  it('refuses two digits, and different tails', () => {
    expect(tailsMatch('16', '316')).toBe(false);
    expect(tailsMatch('6630', '6631')).toBe(false);
    expect(tailsMatch(null, '6630')).toBe(false);
  });
});

describe('matchAccount', () => {
  const account = (id: string, type: string, last4: string | null, issuer: string | null = null) => ({
    id,
    type,
    issuer,
    last4,
    isArchived: false,
  });

  it('finds the one account a tail belongs to', () => {
    expect(
      matchAccount({ type: 'account', tail: '316', issuer: null }, [account('icici', 'bank', '0316')]),
    ).toBe('icici');
  });

  it('narrows by type, then by issuer, and gives up rather than guess', () => {
    const accounts = [
      account('card', 'credit_card', '1234', 'HDFC'),
      account('bank', 'bank', '1234', 'SBI'),
      account('other-card', 'credit_card', '1234', 'Axis'),
    ];
    expect(matchAccount({ type: 'account', tail: '1234', issuer: null }, accounts)).toBe('bank');
    expect(matchAccount({ type: 'card', tail: '1234', issuer: 'HDFC Bank' }, accounts)).toBe('card');
    expect(matchAccount({ type: 'card', tail: '1234', issuer: null }, accounts)).toBeNull();
  });

  it('ignores archived accounts', () => {
    expect(
      matchAccount({ type: 'account', tail: '316', issuer: null }, [
        { ...account('old', 'bank', '316'), isArchived: true },
      ]),
    ).toBeNull();
  });
});

describe('sameTransaction', () => {
  const facts = (overrides: Partial<DuplicateFacts> = {}): DuplicateFacts => ({
    direction: 'debit',
    amountMinor: rupees(500),
    reference: null,
    instrumentTail: '6630',
    postedAt: at(2026, 9, 10, 9, 45),
    packageName: 'com.google.android.apps.messaging',
    bodyKey: 'sent inr 500.00',
    ...overrides,
  });

  it('is settled by a shared reference, either way', () => {
    expect(sameTransaction(facts({ reference: '1' }), facts({ reference: '1', postedAt: 0 }))).toBe(true);
    expect(sameTransaction(facts({ reference: '1' }), facts({ reference: '2' }))).toBe(false);
  });

  it('pairs the bank SMS with the UPI app alert a minute later', () => {
    const app = facts({
      packageName: 'com.phonepe.app',
      instrumentTail: null,
      bodyKey: 'inr 500 paid to meera',
      postedAt: at(2026, 9, 10, 9, 46),
    });
    expect(sameTransaction(facts(), app)).toBe(true);
  });

  it('never pairs two different alerts from the same app — that is two payments', () => {
    expect(sameTransaction(facts(), facts({ bodyKey: 'sent inr 500.00 to someone else' }))).toBe(false);
  });

  it('recognises a re-posted notification as itself', () => {
    expect(sameTransaction(facts(), facts({ postedAt: at(2026, 9, 10, 9, 50) }))).toBe(true);
  });

  it('keeps apart different amounts, directions, tails, or payments far apart', () => {
    const other = { packageName: 'com.phonepe.app', bodyKey: 'x' };
    expect(sameTransaction(facts(), facts({ ...other, amountMinor: rupees(501) }))).toBe(false);
    expect(sameTransaction(facts(), facts({ ...other, direction: 'credit' }))).toBe(false);
    expect(sameTransaction(facts(), facts({ ...other, instrumentTail: '9999' }))).toBe(false);
    expect(sameTransaction(facts(), facts({ ...other, postedAt: at(2026, 9, 10, 10, 30) }))).toBe(false);
  });
});

describe('looksLikeManual', () => {
  const expense = { amountMinor: rupees(120), occurredAt: at(2026, 9, 12, 9), accountId: 'hdfc' };

  it('offers a link for the same amount on the same day', () => {
    expect(looksLikeManual({ amountMinor: rupees(120), occurredAt: at(2026, 9, 12, 16), accountId: null }, expense)).toBe(true);
  });

  it('does not for another day, another amount or another account', () => {
    expect(looksLikeManual({ amountMinor: rupees(120), occurredAt: at(2026, 9, 13), accountId: null }, expense)).toBe(false);
    expect(looksLikeManual({ amountMinor: rupees(121), occurredAt: at(2026, 9, 12), accountId: null }, expense)).toBe(false);
    expect(looksLikeManual({ amountMinor: rupees(120), occurredAt: at(2026, 9, 12), accountId: 'sbi' }, expense)).toBe(false);
  });
});

describe('suggest', () => {
  const categories = [
    { id: 'food', name: 'Food', isArchived: false },
    { id: 'groceries', name: 'Groceries', isArchived: true },
    { id: 'bills', name: 'Bills', isArchived: false },
  ];
  const accounts = [{ id: 'hdfc', type: 'bank', issuer: 'HDFC', last4: '6630', isArchived: false }];
  const rule: Rule = {
    id: 'r1',
    name: 'Super Money is my card bill',
    priority: 1,
    isEnabled: true,
    matchMode: 'all',
    conditions: [{ field: 'item', operator: 'contains', value: 'super money' }],
    actions: [
      { type: 'set_category', categoryId: 'bills' },
      { type: 'set_counts_to_budget', countsToBudget: false },
    ],
    timesApplied: 0,
  };

  const detection = (body: string) =>
    detect({ body, sender: 'VM-HDFCBK', receivedAt: at(2026, 9, 5, 16) });

  it('lets the user’s rule decide first', () => {
    const suggestion = suggest(detection('Sent Rs.218.00\nFrom HDFC Bank A/C *6630\nTo Super Money\nOn 05/09/26'), {
      rules: [rule],
      categories,
      accounts,
    });
    expect(suggestion).toEqual({ categoryId: 'bills', accountId: 'hdfc', ruleId: 'r1', countsToBudget: false });
  });

  it('falls back to the merchant list, by category name', () => {
    const suggestion = suggest(detection('Sent Rs.250.00 from HDFC Bank A/C *6630 to swiggy@axisbank'), {
      rules: [],
      categories,
      accounts,
    });
    expect(suggestion.categoryId).toBe('food');
    expect(suggestion.ruleId).toBeNull();
  });

  it('suggests nothing for an archived category rather than bringing it back', () => {
    const suggestion = suggest(detection('Sent Rs.250.00 from HDFC Bank A/C *6630 to blinkit@hdfc'), {
      rules: [],
      categories,
      accounts,
    });
    expect(suggestion.categoryId).toBeNull();
  });

  it('never matches a rule against the message boilerplate', () => {
    const upiRule: Rule = { ...rule, conditions: [{ field: 'note', operator: 'contains', value: 'upi' }] };
    const suggestion = suggest(detection('Sent Rs.250.00 via UPI to swiggy@axisbank'), {
      rules: [upiRule],
      categories,
      accounts: [],
    });
    expect(suggestion.ruleId).toBeNull();
  });
});

describe('categoryNameFor', () => {
  it('reads a merchant from a VPA or a name', () => {
    expect(categoryNameFor('swiggy.instamart@icici')).toBe('Food');
    expect(categoryNameFor(null, 'Big Bazaar')).toBe('Groceries');
    expect(categoryNameFor('Meera K S')).toBeNull();
  });
});

describe('captureKey', () => {
  const base = {
    source: 'notification' as const,
    packageName: 'com.google.android.apps.messaging',
    sender: 'VM-HDFCBK',
    title: null,
    body: 'Sent Rs.500.00 From HDFC Bank A/C *6630',
    postedAt: at(2026, 9, 10, 9, 45),
  };

  it('is the same for the same message re-delivered in the same minute', () => {
    expect(captureKey(base)).toBe(captureKey({ ...base, body: 'Sent  Rs. 500.00 From HDFC Bank A/C *6630 ' }));
  });

  it('differs a minute later, so two identical payments are not merged', () => {
    expect(captureKey(base)).not.toBe(captureKey({ ...base, postedAt: base.postedAt + 60_000 }));
  });

  it('ignores the time for pasted text, so pasting twice is one message', () => {
    const paste = { ...base, source: 'paste' as const, packageName: null, sender: null };
    expect(captureKey(paste)).toBe(captureKey({ ...paste, postedAt: 0 }));
  });

  it('folds case and spacing in the body key', () => {
    expect(bodyKeyOf('Sent  RS.500')).toBe(bodyKeyOf('sent inr 500'));
  });
});

describe('maskMessage', () => {
  it('scrambles references, tails, UPI ids and a greeting name, and keeps amounts', () => {
    const masked = maskMessage(
      'Dear Sreekanth, Rs.500.00 credited to HDFC Bank A/c XX6630 from VPA srekthk@okaxis (UPI 625325710634)',
    );
    expect(masked).toContain('Dear NAME');
    expect(masked).toContain('Rs.500.00');
    expect(masked).toContain('name@okaxis');
    expect(masked).not.toContain('6630');
    expect(masked).not.toContain('625325710634');
    expect(masked).toMatch(/UPI \d{12}\)/);
  });

  it('keeps the shape a parser needs, so a masked message reads the same way', () => {
    const original =
      'ICICI Bank Acct XX316 debited for Rs 720.00 on 02-Sep-26; KSBC FL017040 P credited. UPI:624568811772.';
    const before = detect({ body: original, receivedAt: at(2026, 9, 2, 19) });
    const after = detect({ body: maskMessage(original), receivedAt: at(2026, 9, 2, 19) });
    expect(after.amountMinor).toBe(asMinor(72000));
    expect(after.kind).toBe(before.kind);
    expect(after.reference).toHaveLength(12);
  });
});
