import {
  bindingOf,
  canAddInBatch,
  compileTemplate,
  countsTowardBadge,
  deriveSegments,
  detect,
  doubtSentence,
  isDoubted,
  normaliseText,
  sectionOf,
  tokenise,
  type MessageInput,
  type Tag,
  type TemplateField,
} from '@/domain/txn-detect';
import { gateSignals } from '@/domain/txn-detect/classify';

/*
 * Reader 3 (D21): gates that count only when they lead the message, and
 * doubts that move a payment from Needs review to Maybe without changing what
 * it is.
 */

const AT = new Date(2026, 9, 5, 12, 0).getTime();
const sms = (body: string, sender: string | null, extra: Partial<MessageInput> = {}): MessageInput => ({
  body,
  sender,
  packageName: 'com.google.android.apps.messaging',
  receivedAt: AT,
  ...extra,
});

const placed = (message: MessageInput) => {
  const detection = detect(message);
  return { kind: detection.kind, section: sectionOf({ ...detection, doubt: isDoubted(detection.reasons) }) };
};

describe('gates that count only when they come first', () => {
  it('file an offer that leads with its pitch, though it says paid or credited', () => {
    expect(detect(sms('Get flat Rs 75 off on recharges! Paid Rs 300 or more this week? Pay via the app now.', 'VK-AIRBNK-S')).kind).toBe('promo');
    expect(detect(sms('Your pre-approved credit card with Rs 1,00,000 limit can be credited to you today. Apply now', 'JD-AXISBK-S')).kind).toBe('upcoming');
    expect(
      detect(sms('Convert your transaction of Rs 24,000.00 at CROMA on Card XX7781 to easy EMIs. Reply YES to 56161', 'JD-HDFCBK-S')).kind,
    ).toBe('promo');
  });

  it('leave a real payment alone when the pitch comes after it', () => {
    expect(placed(sms('Rs.640.00 spent on Card XX7781 at DOMINOS on 05-10-26. Shop now for 5% back with code PIZZA5.', 'JD-HDFCBK-T'))).toEqual({
      kind: 'transaction',
      section: 'review',
    });
    expect(detect(sms('Rs 2,000.00 credited to A/c XX3344 by IMPS from RAVI K. Your next salary will be credited on the 1st.', 'JD-KOTAKB-S')).kind).toBe(
      'transaction',
    );
  });

  it('read a future credit as upcoming, and a past one as money in', () => {
    expect(detect(sms('Rs 15,000 will be credited to your account once your loan is disbursed.', 'AD-IDFCFB-S')).kind).toBe('upcoming');
  });

  it('file a limit change as a notice, but not a spend that mentions the limit', () => {
    const notice = detect(sms('Your Card XX7781 credit limit has been enhanced to Rs 2,50,000.', 'JD-SBICRD-S'));
    expect([notice.kind, notice.reasons]).toEqual(['balance', expect.arrayContaining(['kind:limit'])]);
    expect(detect(sms('Rs 999.00 spent on Card XX7781 at MYNTRA. Available limit Rs 40,000.', 'JD-SBICRD-T')).kind).toBe('transaction');
  });

  it('names every gate a message trips, including the ones a past verb overruled', () => {
    expect(gateSignals('Cashback offer: Rs 50 credited to your wallet')).toEqual(
      expect.arrayContaining(['promo', 'refund', 'past-verb']),
    );
    expect(gateSignals('Rs 500 debited from A/c XX1234')).toEqual(['past-verb']);
  });
});

describe('doubt', () => {
  it('doubts a payment from a promotional sender, and only a payment', () => {
    const doubted = detect(sms('Rs.499 debited from your A/c XX1234 for Premium plan. Enjoy!', 'VM-HDFCBK-P'));
    expect([doubted.kind, doubted.reasons]).toEqual(['transaction', expect.arrayContaining(['doubt:promo-sender'])]);
    expect(isDoubted(detect(sms('Rs.499 debited from your A/c XX1234 for Premium plan.', 'JD-HDFCBK-T')).reasons)).toBe(false);
    expect(isDoubted(detect(sms('Rs.499 credited to your A/c XX1234.', 'VM-HDFCBK-P')).reasons)).toBe(false);
  });

  it('doubts a person writing from an SMS app, but not a bank saved as a contact', () => {
    const friend = detect(sms('I paid Rs 800 for the tickets, send me your share', null, { title: 'Aa' }));
    expect(friend.reasons).toContain('doubt:no-sender');
    const contact = detect(sms('Rs.800.00 debited from A/c XX1234 to BOOKMYSHOW', null, { title: 'HDFC Bank' }));
    expect(isDoubted(contact.reasons)).toBe(false);
    const pasted = detect({ body: 'I paid Rs 800 for the tickets', receivedAt: AT });
    expect(isDoubted(pasted.reasons)).toBe(false);
  });

  it('never doubts a format the user taught, which has the last word (D18)', () => {
    const sample = sms('Rs.450.00 debited from A/c XX5521 to ZOMATO on 05-10-26', 'VM-JANABK-P');
    const text = normaliseText(sample.body);
    const tokens = tokenise(text);
    const tag = (field: TemplateField, covered: string): Tag => {
      const from = text.indexOf(covered);
      const to = from + covered.length;
      const indexes = tokens.flatMap((token, index) => (token.end > from && token.start < to ? [index] : []));
      return { field, start: indexes[0], end: indexes[indexes.length - 1] + 1 };
    };
    expect(detect(sample).reasons).toContain('doubt:promo-sender');
    const compiled = compileTemplate({
      id: 't1',
      name: 'Taught',
      binding: bindingOf(sample),
      outcome: 'transaction',
      direction: 'debit',
      overridesGate: null,
      segments: deriveSegments(text, [tag('amount', '450.00'), tag('counterparty', 'ZOMATO')]),
      updatedAt: 1,
    })!;
    const taught = detect(sample, { templates: [compiled] });
    expect(taught.reasons).toContain('template:t1');
    expect(isDoubted(taught.reasons)).toBe(false);
  });
});

describe('a doubted payment in the inbox', () => {
  const base = { kind: 'transaction' as const, direction: 'debit' as const, confidence: 'high' as const, amountMinor: 49900, currency: 'INR' };

  it('waits in Maybe, still counted, never batch-added', () => {
    expect(sectionOf({ ...base, doubt: true })).toBe('maybe');
    expect(countsTowardBadge({ ...base, doubt: true })).toBe(true);
    expect(canAddInBatch({ ...base, doubt: true })).toBe(false);
    expect(canAddInBatch(base)).toBe(true);
  });

  it('changes nothing filed or money in', () => {
    expect(sectionOf({ ...base, kind: 'promo', doubt: true })).toBe('filtered');
    expect(sectionOf({ ...base, direction: 'credit', doubt: true })).toBe('money_in');
  });
});

describe('doubtSentence', () => {
  it('says why a payment waits in Maybe, in words', () => {
    expect(doubtSentence(['kind:transaction', 'doubt:promo-sender'])).toBe(
      'In Maybe, not Needs review. It came from a promotional sender id, which banks do not send payment alerts from.',
    );
    expect(doubtSentence(['doubt:something-new'])).toBe('In Maybe, not Needs review: Finly is not sure this is a payment.');
    expect(doubtSentence(['kind:transaction'])).toBeNull();
  });
});
