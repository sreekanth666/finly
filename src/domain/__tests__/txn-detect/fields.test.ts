import { rupees } from '@/domain/money';
import { dayKey, formatTime } from '@/domain/period';
import { readAmounts } from '@/domain/txn-detect/amount';
import { readDate } from '@/domain/txn-detect/date';
import { readInstrument, readReference } from '@/domain/txn-detect/fields';
import { detect, labelOf, normaliseText } from '@/domain/txn-detect';

const at = (year: number, month1: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month1 - 1, day, hour, minute).getTime();

describe('normaliseText', () => {
  it('spells every rupee mark the same way, glued or not', () => {
    expect(normaliseText('Rs.500 Rs 500 Rs:500 Rs2000 ₹500 INR.500 INR500')).toBe(
      'INR 500 INR 500 INR 500 INR 2000 INR 500 INR 500 INR 500',
    );
  });

  it('leaves a name that happens to start with Rs alone', () => {
    expect(normaliseText('paid to RS Traders')).toBe('paid to RS Traders');
  });

  it('keeps line breaks but collapses the spaces inside a line', () => {
    expect(normaliseText('To MEERA  K S\r\nOn 10/09/26')).toBe('To MEERA K S\nOn 10/09/26');
  });
});

describe('readAmounts', () => {
  const read = (body: string) => readAmounts(normaliseText(body));

  it('prefers the figure beside the verb over the balance after it', () => {
    const reading = read('Rs 500 debited. Avl Bal Rs 12,000.00');
    expect(reading.best?.amountMinor).toBe(rupees(500));
    expect(reading.candidates).toEqual([rupees(500), rupees(12000)]);
    expect(reading.ambiguous).toBe(false);
  });

  it('prefers the figure beside the verb even when the balance comes first', () => {
    expect(read('Avl Bal Rs 9,000.00. Rs 250 debited from A/c XX12').best?.amountMinor).toBe(rupees(250));
  });

  it('reads a bare figure with paise after "debited by", as SBI writes it', () => {
    const reading = read('A/C X8783 debited by 1000.00 on date 10Sep26');
    expect(reading.best?.amountMinor).toBe(rupees(1000));
    expect(reading.best?.marked).toBe(false);
  });

  it('never reads a reference or a phone number as an amount', () => {
    expect(read('Ref 129385983254 Call 18002586161').best).toBeNull();
  });

  it('reads lakh grouping and "/-" without drifting a paisa', () => {
    expect(read('INR 10,00,000.50 debited').best?.amountMinor).toBe(100000050);
    expect(read('Rs 1000/- debited').best?.amountMinor).toBe(rupees(1000));
  });

  it('calls two unexplained figures ambiguous', () => {
    expect(read('INR 100.00 and INR 200.00').ambiguous).toBe(true);
  });
});

describe('readDate', () => {
  const received = at(2026, 9, 10, 18, 30);
  const read = (text: string, receivedAt = received) => readDate(text, receivedAt);

  it.each([
    ['on 02-Sep-26', '2026-09-02'],
    ['on 10/09/26', '2026-09-10'],
    ['on date 10Sep26', '2026-09-10'],
    ['On 2026-09-03:14:22:10', '2026-09-03'],
    ['on 09-SEP-2026', '2026-09-09'],
    ['on 12 September 2025', '2025-09-12'],
    ['on 1st Sep', '2026-09-01'],
  ])('reads %s', (text, expected) => {
    expect(dayKey(read(text).occurredAt)).toBe(expected);
  });

  it('reads a 12-hour time after a date with no year', () => {
    const reading = read('on 02 Sep 07:12 PM for UPI');
    expect(dayKey(reading.occurredAt)).toBe('2026-09-02');
    expect(formatTime(reading.occurredAt)).toBe('19:12');
    expect(reading.confidence).toBe('exact');
  });

  it('does not mistake the hour for a two-digit year', () => {
    expect(new Date(read('on 02 Sep 07:12 PM').occurredAt).getFullYear()).toBe(2026);
  });

  it('reads 12 AM as midnight and 12 PM as noon', () => {
    expect(formatTime(read('on 02 Sep 12:05 AM').occurredAt)).toBe('00:05');
    expect(formatTime(read('on 02 Sep 12:05 PM').occurredAt)).toBe('12:05');
  });

  it('puts a no-year date that would be in the future into last year', () => {
    const newYear = at(2027, 1, 1, 0, 5);
    expect(dayKey(read('on 30 Dec 11:40 PM', newYear).occurredAt)).toBe('2026-12-30');
  });

  it('takes the arrival time for a date-only message that arrived the same day', () => {
    const reading = read('on 10-09-26');
    expect(reading.occurredAt).toBe(received);
    expect(reading.confidence).toBe('day_only');
  });

  it('uses local noon for a date-only message about an earlier day', () => {
    expect(formatTime(read('on 08-09-26').occurredAt)).toBe('12:00');
  });

  it('swaps day and month only when the middle number cannot be a month', () => {
    expect(dayKey(read('on 08/13/2026').occurredAt)).toBe('2026-08-13');
    expect(dayKey(read('on 03/04/2026').occurredAt)).toBe('2026-04-03');
  });

  it('falls back to the arrival time for no date, an impossible one, or one far away', () => {
    expect(read('no date here').confidence).toBe('fallback_received');
    expect(read('on 31-02-26').implausible).toBe(true);
    expect(read('on 01-01-20').implausible).toBe(true);
    expect(read('on 01-01-20').occurredAt).toBe(received);
  });
});

describe('readInstrument', () => {
  it.each([
    ['ICICI Bank Acct XX316 debited', 'account', '316'],
    ['your ICICI Bank Account XXX316 has been', 'account', '316'],
    ['From HDFC Bank A/C *6630', 'account', '6630'],
    ['ur A/cX8783 credited', 'account', '8783'],
    ['A/c no. XX4455', 'account', '4455'],
    ['from A/c ...5566 to', 'account', '5566'],
    ['Kotak Bank AC X1122 to', 'account', '1122'],
    ['your SuperCard 0194 debited', 'card', '0194'],
    ['OneCard ending 4321 was', 'card', '4321'],
    ['AMEX card ** 11005 at', 'card', '11005'],
    ['Card no. XX7788', 'card', '7788'],
  ])('reads "%s"', (text, type, tail) => {
    expect(readInstrument(text)).toEqual({ type, tail });
  });

  it('skips the loan account an EMI was paid towards', () => {
    expect(readInstrument('EMI for loan a/c XX5566 debited from A/c XX6630').tail).toBe('6630');
  });

  it('knows a wallet with no number', () => {
    expect(readInstrument('paid using Amazon Pay balance')).toEqual({ type: 'wallet', tail: null });
  });
});

describe('readReference', () => {
  it.each([
    ['UPI:624568811772.', '624568811772'],
    ['(UPI 625325710634)', '625325710634'],
    ['for UPI - 661184090154.', '661184090154'],
    ['UPI/P2M/624512345678/ZOMATO', '624512345678'],
    ['Refno 110645528048 If', '110645528048'],
    ['(Ref no 624911223344)', '624911223344'],
    ['Ref RTGS1234567', 'RTGS1234567'],
  ])('reads %s', (text, expected) => {
    expect(readReference(text)).toBe(expected);
  });

  it('does not read "Refund" or a four-digit transaction number as a reference', () => {
    expect(readReference('Refund of INR 1,249.00 Txn# 1234')).toBeNull();
  });
});

describe('labelOf', () => {
  it.each([
    ['swiggy@axisbank', 'Swiggy'],
    ['arjun.k@okaxis', 'Arjun K'],
    ['KSBC FL017040 P', 'KSBC P'],
    ['MEERA  K S', 'Meera K S'],
    ['ACME TECHNOLOGIES PVT LTD', 'Acme Technologies Pvt Ltd'],
    ['OPENAI *CHATGPT', 'Openai Chatgpt'],
    ['Super Money', 'Super Money'],
    ['KSRTC', 'KSRTC'],
  ])('%s → %s', (raw, expected) => {
    expect(labelOf(raw)).toBe(expected);
  });

  it('is null when nothing name-like is left', () => {
    expect(labelOf('9876543210@ybl')).toBeNull();
    expect(labelOf('UPI/624944445555')).toBeNull();
  });
});

describe('detect, on what is not in the corpus', () => {
  it('keeps a message it cannot read at all, with nothing invented', () => {
    const detection = detect({ body: 'Hello from your bank', receivedAt: at(2026, 9, 1) });
    expect(detection.kind).toBe('unknown');
    expect(detection.amountMinor).toBeNull();
    expect(detection.confidence).toBe('low');
    expect(detection.item).toBe('Payment');
  });

  it('never throws on empty or hostile input', () => {
    for (const body of ['', '   ', '₹', 'INR ,,,,', '(((((', 'a'.repeat(5000), '9'.repeat(400)]) {
      expect(() => detect({ body, receivedAt: at(2026, 9, 1) })).not.toThrow();
    }
  });
});
