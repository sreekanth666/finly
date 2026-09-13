import { asMinor, rupees } from '@/domain/money';
import {
  bindingOf,
  checkTemplate,
  compileTemplate,
  decodeSegments,
  deriveSegments,
  detect,
  encodeSegments,
  matchTemplates,
  normaliseText,
  orderTemplates,
  readsBack,
  suggestTags,
  taggedValues,
  tapToken,
  tokenise,
  type CompiledTemplate,
  type MessageInput,
  type Tag,
  type TemplateField,
  type TemplateOutcome,
  type TemplateSpec,
} from '@/domain/txn-detect';

import { ALL_MESSAGES } from '../fixtures/messages';

const at = (year: number, month1: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month1 - 1, day, hour, minute).getTime();

/** Tags by the text they cover, the way a person taps them. */
function tag(text: string, field: TemplateField, covered: string): Tag {
  const tokens = tokenise(text);
  const from = text.indexOf(covered);
  if (from === -1) throw new Error(`"${covered}" is not in the sample`);
  const to = from + covered.length;
  const indexes = tokens.flatMap((token, index) => (token.end > from && token.start < to ? [index] : []));
  return { field, start: indexes[0], end: indexes[indexes.length - 1] + 1 };
}

/** What the editor does on Save: derive, check, bind, compile. */
function teach(
  sample: MessageInput,
  tags: (text: string) => Tag[],
  options: { outcome?: TemplateOutcome; direction?: 'debit' | 'credit' | null; id?: string } = {},
): { spec: TemplateSpec; compiled: CompiledTemplate; text: string; tags: Tag[] } {
  const text = normaliseText(sample.body);
  const chosen = tags(text);
  const reading = detect(sample);
  const spec: TemplateSpec = {
    id: options.id ?? 't1',
    name: 'Taught',
    binding: bindingOf(sample),
    outcome: options.outcome ?? 'transaction',
    direction: options.direction === undefined ? 'debit' : options.direction,
    overridesGate: ['transaction', 'unknown'].includes(reading.kind) ? null : reading.kind,
    segments: deriveSegments(text, chosen),
    updatedAt: 1,
  };
  const compiled = compileTemplate(spec);
  if (compiled === null) throw new Error('did not compile');
  return { spec, compiled, text, tags: chosen };
}

/* A bank the generic reader does not know: no currency mark, no money verb it
   recognises, a sender id with no hint. It reads as unknown today. */
const JANA = (amount: string, to: string): MessageInput => ({
  body: `JanaBank: A sum of ${amount} moved out of a/c ending 5521 to ${to}, bal 9,120.30`,
  sender: 'JM-JANABK-S',
  receivedAt: at(2026, 9, 12, 10),
});

const HDFC_SENT = (amount: string, to: string, ref: string): MessageInput => ({
  body: [
    `Sent Rs.${amount}`,
    'From HDFC Bank A/C *6630',
    `To ${to}`,
    'On 10/09/26',
    `Ref ${ref}`,
    'Not You?',
    'Call 18002586161/SMS BLOCK UPI to 7308080808',
  ].join('\n'),
  sender: 'VM-HDFCBK',
  receivedAt: at(2026, 9, 10, 9, 45),
});

const janaTemplate = () =>
  teach(JANA('1,450.00', 'KAVYA STORES'), (text) => [
    tag(text, 'amount', '1,450.00'),
    tag(text, 'counterparty', 'KAVYA STORES'),
  ]);

describe('tokenise', () => {
  it('splits glued fields apart so each can be tapped', () => {
    expect(tokenise('UPI/P2M/624512345678/ZOMATO').map((token) => token.text)).toEqual([
      'UPI', '/', 'P', '2', 'M', '/', '624512345678', '/', 'ZOMATO',
    ]);
  });

  it('keeps a grouped figure whole and a line break as its own token', () => {
    const tokens = tokenise('INR 1,02,000.50,\nTo X');
    expect(tokens.map((token) => token.text)).toEqual(['INR', '1,02,000.50', ',', '\n', 'To', 'X']);
    expect(tokens.map((token) => token.glued)).toEqual([false, false, true, true, true, false]);
  });
});

describe('a taught format', () => {
  it('reads a message the generic reader could not', () => {
    const message = JANA('90.00', 'CHAI HUT');
    expect(detect(message).kind).toBe('unknown');

    const { compiled } = janaTemplate();
    const detection = detect(message, { templates: [compiled] });

    expect(detection.kind).toBe('transaction');
    expect(detection.direction).toBe('debit');
    expect(detection.amountMinor).toBe(rupees(90));
    expect(detection.currency).toBe('INR');
    expect(detection.counterparty).toBe('CHAI HUT');
    expect(detection.item).toBe('Chai Hut');
    expect(detection.instrumentTail).toBe('5521');
    expect(detection.confidence).toBe('high');
    expect(detection.reasons).toContain('template:t1');
    expect(detection.reasons).toContain('amount:template');
  });

  it('reads a payee of a different length than the one it was taught on', () => {
    const { compiled } = janaTemplate();
    const detection = detect(JANA('2,000.00', 'SRI VENKATESWARA MEDICAL HALL'), { templates: [compiled] });
    expect(detection.counterparty).toBe('SRI VENKATESWARA MEDICAL HALL');
  });

  it('keeps a multi-line format line by line', () => {
    const { compiled, spec } = teach(HDFC_SENT('500.00', 'MEERA  K S', '129385983254'), (text) => [
      tag(text, 'amount', '500.00'),
      tag(text, 'counterparty', 'MEERA K S'),
    ]);
    expect(spec.segments.some((segment) => segment.type === 'newline')).toBe(true);

    const detection = detect(HDFC_SENT('218.00', 'Super Money Limited', '624820340289'), { templates: [compiled] });
    expect(detection.amountMinor).toBe(rupees(218));
    expect(detection.counterparty).toBe('Super Money Limited');
    expect(detection.reference).toBe('624820340289');
  });

  it('reads a payee glued inside a UPI narration', () => {
    const axis = (ref: string, merchant: string): MessageInput => ({
      body: `INR 350.00 debited\nA/c no. XX4455\n05-09-26, 13:45:12\nUPI/P2M/${ref}/${merchant}\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank`,
      sender: 'AX-AXISBK',
      receivedAt: at(2026, 9, 5, 13, 46),
    });
    const { compiled } = teach(axis('624512345678', 'ZOMATO'), (text) => [
      tag(text, 'amount', '350.00'),
      tag(text, 'counterparty', 'ZOMATO'),
    ]);
    const detection = detect(axis('624599998888', 'SWIGGY INSTAMART'), { templates: [compiled] });
    expect(detection.counterparty).toBe('SWIGGY INSTAMART');
    expect(detection.reference).toBe('624599998888');
  });

  it('reads its own sample back exactly, which is the gate before saving', () => {
    const { spec, text, tags } = janaTemplate();
    expect(readsBack(spec, text, taggedValues(text, tags))).toBe(true);
    expect(taggedValues(text, tags)).toEqual({
      amountMinor: rupees(1450),
      counterparty: 'KAVYA STORES',
      reference: null,
      tail: null,
    });
  });

  it('takes the currency mark with a tapped figure', () => {
    const sample: MessageInput = {
      body: 'Kiran Bank: USD 12.99 charged on card 4321 at OPENAI LLC. Help 1800123',
      sender: 'VM-KIRANB',
      receivedAt: at(2026, 9, 10, 9),
    };
    const { compiled } = teach(sample, (text) => [tag(text, 'amount', '12.99'), tag(text, 'counterparty', 'OPENAI LLC')]);
    const detection = detect(
      { ...sample, body: 'Kiran Bank: INR 450.00 charged on card 4321 at IRCTC. Help 1800123' },
      { templates: [compiled] },
    );
    expect(detection.amountMinor).toBe(rupees(450));
    expect(detection.currency).toBe('INR');
  });
});

describe('what keeps a template from reading the wrong message', () => {
  it('never applies to another sender', () => {
    const { compiled } = janaTemplate();
    const elsewhere = { ...JANA('90.00', 'CHAI HUT'), sender: 'VM-HDFCBK' };
    expect(detect(elsewhere, { templates: [compiled] })).toEqual(detect(elsewhere));
  });

  it('never claims an OTP, even one that quotes the format word for word', () => {
    const { compiled } = janaTemplate();
    const otp: MessageInput = {
      ...JANA('1,450.00', 'KAVYA STORES'),
      body: 'JanaBank: 482913 is your OTP. A sum of 1,450.00 moved out of a/c ending 5521 to KAVYA STORES, bal 9,120.30',
    };
    expect(detect(otp, { templates: [compiled] }).kind).toBe('otp');
  });

  it('overrules only the gate its own sample tripped', () => {
    const { compiled } = janaTemplate();
    const asStatement = { ...compiled, spec: { ...compiled.spec, overridesGate: 'statement' as const } };
    const message = { text: normaliseText(JANA('90.00', 'X Y').body), binding: bindingOf(JANA('1', 'Z')) };

    expect(matchTemplates([asStatement], { ...message, classified: 'statement' })).not.toBeNull();
    expect(matchTemplates([asStatement], { ...message, classified: 'otp' })).toBeNull();
    expect(matchTemplates([compiled], { ...message, classified: 'statement' })).toBeNull();
    expect(matchTemplates([compiled], { ...message, classified: 'transaction' })).not.toBeNull();
  });

  it('falls through when the figure it lands on is not an amount', () => {
    const { compiled } = janaTemplate();
    const zero = JANA('0.00', 'CHAI HUT');
    expect(detect(zero, { templates: [compiled] })).toEqual(detect(zero));
  });

  it('does not bind to the SMS app, which every SMS shares', () => {
    expect(
      bindingOf({ packageName: 'com.google.android.apps.messaging', title: 'JM-JANABK', body: 'x' }),
    ).toEqual({ senderKey: 'JANABK', packageName: null, issuer: null });
    expect(bindingOf({ packageName: 'com.phonepe.app', body: '₹99 paid' }).packageName).toBe('com.phonepe.app');
  });

  it('uses the issuer only when one side has no sender id', () => {
    const pasted = { body: 'HDFC Bank: Rs 500 debited', receivedAt: 0 };
    const taughtFromPaste = bindingOf(pasted);
    expect(taughtFromPaste).toEqual({ senderKey: null, packageName: null, issuer: 'HDFC Bank' });
    const { compiled } = janaTemplate();
    const fromPaste = { ...compiled, spec: { ...compiled.spec, binding: taughtFromPaste } };
    const text = normaliseText(JANA('90.00', 'CHAI HUT').body);

    expect(
      matchTemplates([fromPaste], {
        text,
        binding: { senderKey: 'HDFCBK', packageName: null, issuer: 'HDFC Bank' },
        classified: 'unknown',
      }),
    ).not.toBeNull();
    const boundToSender = { ...compiled, spec: { ...compiled.spec, binding: { senderKey: 'JANABK', packageName: null, issuer: 'HDFC Bank' } } };
    expect(
      matchTemplates([boundToSender], {
        text,
        binding: { senderKey: 'HDFCBK', packageName: null, issuer: 'HDFC Bank' },
        classified: 'unknown',
      }),
    ).toBeNull();
  });

  it('skips a message far longer than any alert, rather than scanning it', () => {
    const { compiled } = janaTemplate();
    const long = { text: 'A sum of 5.00 moved out '.repeat(100), binding: compiled.spec.binding, classified: 'unknown' as const };
    expect(matchTemplates([compiled], long)).toBeNull();
  });
});

describe('muting a format', () => {
  it('files a recurring nuisance under Filtered, undoably', () => {
    const nag: MessageInput = {
      body: 'SuperMoney: Your weekly summary for 01 Sep - 07 Sep is ready. Tap to view.',
      sender: 'VM-SPRMNY',
      receivedAt: at(2026, 9, 8),
    };
    expect(detect(nag).kind).toBe('unknown');
    const { compiled } = teach(nag, () => [], { outcome: 'ignore', direction: null, id: 'm1' });

    const next = { ...nag, body: 'SuperMoney: Your weekly summary for 08 Sep - 14 Sep is ready. Tap to view.' };
    const detection = detect(next, { templates: [compiled] });
    expect(detection.kind).toBe('promo');
    expect(detection.reasons).toContain('template:mute:m1');
  });
});

describe('the corpus, with templates present', () => {
  it('reads every existing message exactly as before when templates belong to other senders', () => {
    const { compiled } = janaTemplate();
    for (const fixture of ALL_MESSAGES) {
      const context = { ownerName: fixture.ownerName ?? null };
      expect([fixture.name, detect(fixture.input, { ...context, templates: [compiled] })]).toEqual([
        fixture.name,
        detect(fixture.input, context),
      ]);
    }
  });

  it('keeps the same readings when taught a format it already reads, apart from saying so', () => {
    const { compiled } = teach(HDFC_SENT('500.00', 'MEERA  K S', '129385983254'), (text) => [
      tag(text, 'amount', '500.00'),
      tag(text, 'counterparty', 'MEERA K S'),
    ]);
    for (const fixture of ALL_MESSAGES) {
      const context = { ownerName: fixture.ownerName ?? null };
      const before = detect(fixture.input, context);
      const after = detect(fixture.input, { ...context, templates: [compiled] });
      const strip = ({ reasons, ...rest }: typeof before) => rest;
      if (!after.reasons.includes('template:t1')) {
        expect([fixture.name, after]).toEqual([fixture.name, before]);
      } else if (before.kind === 'transaction') {
        expect([fixture.name, strip(after)]).toEqual([fixture.name, strip(before)]);
      }
    }
  });
});

describe('checkTemplate', () => {
  const base = (): TemplateSpec => janaTemplate().spec;

  it('passes a well-taught format', () => {
    expect(checkTemplate(base())).toEqual({ errors: [], warnings: [] });
  });

  it('refuses a format it cannot tie to a sender', () => {
    const spec = { ...base(), binding: { senderKey: null, packageName: null, issuer: null } };
    expect(checkTemplate(spec).errors).toHaveLength(1);
  });

  it('needs an amount and a direction for a payment, but not for a mute', () => {
    const spec = base();
    const noAmount = { ...spec, segments: spec.segments.filter((s) => !(s.type === 'field' && s.field === 'amount')) };
    expect(checkTemplate(noAmount).errors).toContain('Tap the amount in the message.');
    expect(checkTemplate({ ...spec, direction: null }).errors).toContain('Say whether the money went out or came in.');
    expect(checkTemplate({ ...noAmount, outcome: 'ignore', direction: null }).errors).toEqual([]);
  });

  it('warns when only common words hold the pattern in place', () => {
    const spec: TemplateSpec = {
      ...base(),
      segments: [
        { type: 'anchor', text: 'debited', glued: false },
        { type: 'field', field: 'amount', glued: false },
      ],
    };
    expect(checkTemplate(spec).warnings).toHaveLength(1);
  });
});

describe('suggestTags', () => {
  it('pre-tags what the generic reader found, so only the wrong part needs a tap', () => {
    const sample: MessageInput = {
      body: 'ICICI Bank Acct XX316 debited for Rs 720.00 on 02-Sep-26; KSBC FL017040 P credited. UPI:624568811772.',
      sender: 'JD-ICICIT-S',
      receivedAt: at(2026, 9, 2, 19, 14),
    };
    const text = normaliseText(sample.body);
    const reading = detect(sample);
    const tags = suggestTags(text, reading);
    expect(taggedValues(text, tags)).toEqual({
      amountMinor: asMinor(72000),
      counterparty: 'KSBC FL017040 P',
      reference: '624568811772',
      tail: '316',
    });
  });
});

describe('segment encoding', () => {
  it('round-trips, and rejects anything malformed', () => {
    const { spec } = janaTemplate();
    expect(decodeSegments(encodeSegments(spec.segments))).toEqual(spec.segments);
    expect(decodeSegments(['a:x', 'f:salary'])).toBeNull();
    expect(decodeSegments('not a list')).toBeNull();
    expect(decodeSegments([])).toBeNull();
  });

  it('never keeps an untagged figure as a literal, so next month still matches', () => {
    const { spec } = janaTemplate();
    const anchors = spec.segments.flatMap((segment) => (segment.type === 'anchor' ? [segment.text] : []));
    expect(anchors.some((text) => /\d/.test(text))).toBe(false);
  });
});

describe('tapToken', () => {
  const text = normaliseText('Rs.500.00 paid to arjun.k@okaxis on 10/09/26\nRef 1234567');
  const tokens = tokenise(text);
  const indexOf = (value: string) => tokens.findIndex((token) => token.text === value);
  const words = (tags: Tag[], field: TemplateField) => {
    const tag = tags.find((candidate) => candidate.field === field);
    return tag === undefined ? null : tokens.slice(tag.start, tag.end).map((token) => token.text).join('');
  };

  it('tags the figure when the currency mark is tapped', () => {
    expect(words(tapToken(tokens, [], 'amount', indexOf('INR')), 'amount')).toBe('500.00');
  });

  it('grows a payee to reach a second tap on the same line, punctuation and all', () => {
    let tags = tapToken(tokens, [], 'counterparty', indexOf('arjun'));
    tags = tapToken(tokens, tags, 'counterparty', indexOf('okaxis'));
    expect(words(tags, 'counterparty')).toBe('arjun.k@okaxis');
  });

  it('trims a tag from either end, and clears a one-piece tag', () => {
    let tags = tapToken(tokens, [], 'counterparty', indexOf('arjun'));
    tags = tapToken(tokens, tags, 'counterparty', indexOf('on'));
    expect(words(tags, 'counterparty')).toBe('arjun.k@okaxison');
    tags = tapToken(tokens, tags, 'counterparty', indexOf('on'));
    expect(words(tags, 'counterparty')).toBe('arjun.k@okaxis');
    const single = tapToken(tokens, [], 'reference', indexOf('1234567'));
    expect(tapToken(tokens, single, 'reference', indexOf('1234567'))).toEqual([]);
  });

  it('never grows a tag across a line, or over another field', () => {
    let tags = tapToken(tokens, [], 'counterparty', indexOf('arjun'));
    tags = tapToken(tokens, tags, 'counterparty', indexOf('Ref'));
    expect(words(tags, 'counterparty')).toBe('Ref');

    let both = tapToken(tokens, [], 'amount', indexOf('500.00'));
    both = tapToken(tokens, both, 'counterparty', indexOf('paid'));
    both = tapToken(tokens, both, 'counterparty', indexOf('INR'));
    expect(words(both, 'amount')).toBeNull();
    expect(words(both, 'counterparty')).toBe('INR500.00paid');
  });
});

describe('orderTemplates', () => {
  it('tries the more specific template first, then the newer', () => {
    const { compiled } = janaTemplate();
    const narrow = { ...compiled, weight: 40, spec: { ...compiled.spec, id: 'narrow', updatedAt: 1 } };
    const broad = { ...compiled, weight: 10, spec: { ...compiled.spec, id: 'broad', updatedAt: 9 } };
    const newer = { ...compiled, weight: 40, spec: { ...compiled.spec, id: 'newer', updatedAt: 5 } };
    expect(orderTemplates([broad, narrow, newer]).map((template) => template.spec.id)).toEqual([
      'newer',
      'narrow',
      'broad',
    ]);
  });
});
