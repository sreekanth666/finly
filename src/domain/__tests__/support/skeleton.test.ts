import { skeletonOf } from '@/domain/support/skeleton';
import { detect } from '@/domain/txn-detect';

import { ALL_MESSAGES } from '../fixtures/messages';

describe('skeletonOf', () => {
  it('keeps how the bank writes and drops who and how much', () => {
    expect(
      skeletonOf(
        'ICICI Bank Acct XX316 debited for Rs 720.00 on 02-Sep-26; KSBC FL017040 P credited. UPI:624568811772. Call 18002662 for dispute.',
      ),
    ).toBe('ICICI Bank Acct XX999 debited for Rs 9.99 on 02-Sep-26; AA AA999999 A credited. UPI:999999999999. Call 99999999 for dispute.');
  });

  it('removes names from a UPI narration, which masking leaves in', () => {
    const skeleton = skeletonOf('Credited INR 10.00 to A/c X7514 on 10-SEP-2026 Ref UPI/CR/661927960000/RAHUL MENON/PUNB/43360.');
    expect(skeleton).not.toMatch(/rahul|menon/i);
    expect(skeleton).toContain('UPI/CR/999999999999/AA AA/AA/99999');
  });

  it('removes a greeting name, a payee on its own line, and a UPI id', () => {
    const skeleton = skeletonOf('Dear Sreekanth,\nSent Rs.500.00\nTo MEERA K S\nfrom VPA arjun.k@okaxis');
    expect(skeleton).not.toMatch(/sreekanth|meera|arjun/i);
    expect(skeleton).toContain('Sent Rs.9.99');
  });

  it('keeps dates and times, and only real months', () => {
    expect(skeletonOf('on 10Sep26 at 18:11:09 and 2026:05:28, March 28, 2026')).toBe(
      'on 10Sep26 at 18:11:09 and 2026:05:28, March 28, 2026',
    );
    expect(skeletonOf('paid 02 Rahul')).toBe('paid 99 Aa');
  });

  it('removes a payee whose name shares words with a bank, and keeps a whole bank name', () => {
    expect(skeletonOf('Paid Rs.150.00 to SOUTH INDIAN SWEETS via UPI')).toBe('Paid Rs.9.99 to AA AA AA via UPI');
    expect(skeletonOf('Ref UPI/CR/661927960000/UNION TRADERS/PUNB/43360.')).toBe('Ref UPI/CR/999999999999/AA AA/AA/99999.');
    expect(skeletonOf('Rs.75.00 debited - South Indian Bank')).toBe('Rs.9.99 debited - South Indian Bank');
    expect(skeletonOf('- Union Bank of India')).toBe('- Union Bank of India');
  });

  it('removes names in any script, not only Latin letters', () => {
    const skeleton = skeletonOf('Dear ரமேஷ், Rs.500 credited from രാഹുൽ and राहुल');
    expect(skeleton).not.toMatch(/[ऀ-෿]/);
    expect(skeleton).toBe('Dear Aa, Rs.9 credited from Aa and Aa');
  });

  it('drops links, which can carry a personal token', () => {
    expect(skeletonOf('Details: https://2s.ms/UTKSPR/qft7VD -Utkarsh SFBL')).toBe('Details: https://… -Utkarsh SFBL');
  });

  it('reads as the same kind of message, in the same direction, as the message itself', () => {
    for (const fixture of ALL_MESSAGES) {
      if (fixture.ownerName !== undefined) continue; // the owner's name is exactly what a skeleton removes
      const original = detect(fixture.input);
      const shaped = detect({ ...fixture.input, body: skeletonOf(fixture.input.body) });
      expect([fixture.name, shaped.kind, shaped.direction]).toEqual([fixture.name, original.kind, original.direction]);
    }
  });
});
