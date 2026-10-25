import { parseCsv, readDataset, truthOfCategory } from '../fixtures/bench-truth';

describe('parseCsv', () => {
  it('reads quotes, doubled quotes, line breaks inside quotes, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n"two\nlines",z\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['two\nlines', 'z'],
    ]);
  });
});

describe('readDataset', () => {
  it('takes our own labels as the truth', () => {
    const [row] = readDataset('body,kind,sender\n"Rs 500 debited from A/c XX12",transaction,JD-HDFCBK-S\n');
    expect(row).toMatchObject({ truth: 'transaction', group: 'must_capture', sender: 'JD-HDFCBK-S' });
    expect(() => readDataset('body,kind\nhello,spending\n')).toThrow('unknown kind spending');
  });

  it('calls everything in a ham/spam set something that must not count', () => {
    expect(readDataset('v1,v2,,\nham,"Ok lar, see you at 5",,\nspam,"WINNER! Claim 900",,\n').map((row) => row.group)).toEqual([
      'must_not_count',
      'must_not_count',
    ]);
  });

  it('refuses a header it does not know', () => {
    expect(() => readDataset('text,label\nhi,x\n')).toThrow('Unknown dataset header');
  });
});

describe('truthOfCategory', () => {
  it('trusts a service alert only when it plainly says money moved', () => {
    expect(truthOfCategory('Txn Alert: ₹199 debited from a/c ****4307 on 22-Nov.', 'service').group).toBe('must_capture');
    expect(truthOfCategory('Rs 824 credited to your SBI account on 07-02-2025.', 'service').group).toBe('must_capture');
    expect(truthOfCategory('Your OTP is 575718. Do not share.', 'service').group).toBe('must_not_count');
  });

  it('never trusts an offer that names money, and sets it aside', () => {
    expect(truthOfCategory('Offer! Flat 50% off. Txn Alert: ₹49 debited from a/c ****3771', 'promotional').group).toBe('ambiguous');
    expect(truthOfCategory('LIMITED OFFER! FLAT 20% DISCOUNT ON FOOD ORDER.', 'promotional')).toMatchObject({
      truth: 'promo',
      group: 'must_not_count',
    });
  });
});
