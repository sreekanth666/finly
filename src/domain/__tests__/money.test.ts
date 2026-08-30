import {
  addMinor,
  CURRENCIES,
  groupWestern,
  setActiveCurrency,
  toCurrency,
  asMinor,
  clampMinorAtZero,
  entryToMinor,
  formatEntry,
  formatMinor,
  formatMinorParts,
  formatMinorPlain,
  groupIndian,
  minorToEntry,
  parseMinor,
  ratio,
  rupees,
  speakMinor,
  subMinor,
  sumMinor,
  ZERO_MINOR,
} from '@/domain/money';

describe('groupIndian', () => {
  it('groups the last three digits, then pairs', () => {
    expect(groupIndian('5')).toBe('5');
    expect(groupIndian('50')).toBe('50');
    expect(groupIndian('500')).toBe('500');
    expect(groupIndian('5000')).toBe('5,000');
    expect(groupIndian('50000')).toBe('50,000');
    expect(groupIndian('124050')).toBe('1,24,050');
    expect(groupIndian('1234567')).toBe('12,34,567');
    expect(groupIndian('12345678')).toBe('1,23,45,678');
    expect(groupIndian('123456789')).toBe('12,34,56,789');
  });
});

describe('entryToMinor', () => {
  it('reads mid-typing states as the user means them', () => {
    expect(entryToMinor('')).toBe(0);
    expect(entryToMinor('4')).toBe(400);
    expect(entryToMinor('4.')).toBe(400);
    expect(entryToMinor('4.0')).toBe(400);
    expect(entryToMinor('4.05')).toBe(405);
    expect(entryToMinor('1240.5')).toBe(124050);
    expect(entryToMinor('.5')).toBe(50);
  });

  it('does not drift, where a float round-trip would', () => {
    // parseFloat('1240.50') * 100 is the classic failure this guards.
    for (let paise = 1; paise <= 200000; paise += 7) {
      const entry = minorToEntry(asMinor(paise));
      expect(entryToMinor(entry)).toBe(paise);
    }
  });
});

describe('minorToEntry', () => {
  it('round-trips through entryToMinor', () => {
    expect(minorToEntry(ZERO_MINOR)).toBe('');
    expect(minorToEntry(asMinor(400))).toBe('4.00');
    expect(minorToEntry(asMinor(124050))).toBe('1240.50');
    expect(minorToEntry(asMinor(5))).toBe('0.05');
  });
});

describe('parseMinor', () => {
  it('accepts what a spreadsheet or a human actually writes', () => {
    expect(parseMinor('1240.50')).toBe(124050);
    expect(parseMinor('₹1,24,050.50')).toBe(12405050);
    expect(parseMinor('1,240')).toBe(124000);
    expect(parseMinor('  350 ')).toBe(35000);
    expect(parseMinor('0.05')).toBe(5);
    expect(parseMinor('.5')).toBe(50);
  });

  it('treats parentheses and a leading minus as negative', () => {
    expect(parseMinor('-1240.50')).toBe(-124050);
    expect(parseMinor('(1,234.00)')).toBe(-123400);
  });

  it('truncates beyond paise rather than rounding into a neighbour', () => {
    expect(parseMinor('1.999')).toBe(199);
  });

  it('returns null for anything it cannot read', () => {
    expect(parseMinor('')).toBeNull();
    expect(parseMinor('   ')).toBeNull();
    expect(parseMinor('n/a')).toBeNull();
    expect(parseMinor('--')).toBeNull();
  });
});

describe('formatMinor', () => {
  it('formats in rupees with Indian grouping', () => {
    expect(formatMinor(asMinor(124050))).toBe('₹1,240.50');
    expect(formatMinor(asMinor(12405050))).toBe('₹1,24,050.50');
    expect(formatMinor(ZERO_MINOR)).toBe('₹0.00');
    expect(formatMinor(asMinor(5))).toBe('₹0.05');
  });

  it('honours the sign, fraction and symbol switches', () => {
    expect(formatMinor(asMinor(-80000))).toBe('−₹800.00');
    expect(formatMinor(asMinor(-80000), { sign: 'never' })).toBe('₹800.00');
    expect(formatMinor(asMinor(80000), { sign: 'always' })).toBe('+₹800.00');
    expect(formatMinor(asMinor(500000), { showFraction: false })).toBe('₹5,000');
    expect(formatMinor(asMinor(500000), { symbol: false })).toBe('5,000.00');
  });

  it('splits into parts the same way it renders', () => {
    expect(formatMinorParts(asMinor(12405050))).toEqual({
      sign: '',
      symbol: '₹',
      whole: '1,24,050',
      fraction: '50',
    });
  });
});

describe('formatEntry', () => {
  it('keeps a trailing decimal point the user typed', () => {
    expect(formatEntry('')).toBe('₹0');
    expect(formatEntry('124050')).toBe('₹1,24,050');
    expect(formatEntry('1240.')).toBe('₹1,240.');
    expect(formatEntry('1240.5')).toBe('₹1,240.5');
  });
});

describe('arithmetic', () => {
  it('stays exact', () => {
    expect(addMinor(asMinor(10), asMinor(20))).toBe(30);
    expect(subMinor(asMinor(500000), asMinor(580000))).toBe(-80000);
    expect(sumMinor([asMinor(10), asMinor(20), asMinor(5)])).toBe(35);
    expect(sumMinor([])).toBe(0);
    expect(clampMinorAtZero(asMinor(-1))).toBe(0);
    expect(clampMinorAtZero(asMinor(7))).toBe(7);
  });

  it('never divides by a zero or absent credit limit', () => {
    expect(ratio(asMinor(100), asMinor(400))).toBe(0.25);
    expect(ratio(asMinor(100), ZERO_MINOR)).toBe(0);
  });
});

describe('asMinor', () => {
  it('refuses a rupee float that wandered in', () => {
    expect(() => asMinor(1240.5)).toThrow(TypeError);
  });
});

describe('rupees', () => {
  it('converts seed figures without drift', () => {
    expect(rupees(5000)).toBe(500000);
    expect(rupees(1240.5)).toBe(124050);
    expect(rupees(0.07)).toBe(7);
  });
});

describe('speakMinor', () => {
  it('reads out for a screen reader', () => {
    expect(speakMinor(asMinor(500000))).toBe('5,000 rupees');
    expect(speakMinor(asMinor(124050))).toBe('1,240 rupees 50 paise');
    expect(speakMinor(asMinor(-80000))).toBe('minus 800 rupees');
  });
});

describe('formatMinorPlain', () => {
  it('writes a number a spreadsheet can read back', () => {
    expect(formatMinorPlain(asMinor(124050))).toBe('1240.50');
    expect(formatMinorPlain(asMinor(5))).toBe('0.05');
    expect(formatMinorPlain(ZERO_MINOR)).toBe('0.00');
    expect(formatMinorPlain(asMinor(-80000))).toBe('-800.00');
  });

  it('carries no symbol and no grouping', () => {
    const text = formatMinorPlain(asMinor(12345678));
    expect(text).toBe('123456.78');
    expect(text).not.toContain(',');
    expect(text).not.toContain('₹');
  });
});

describe('currency', () => {
  const usd = CURRENCIES.USD;
  const inr = CURRENCIES.INR;

  it('groups by convention, not just by symbol', () => {
    // The same integer, written the two ways. A symbol swap alone would put
    // Indian grouping on a dollar amount.
    expect(formatMinor(asMinor(12405050), { currency: inr })).toBe('₹1,24,050.50');
    expect(formatMinor(asMinor(12405050), { currency: usd })).toBe('$124,050.50');
  });

  it('groups western amounts in threes at every magnitude', () => {
    expect(groupWestern('5')).toBe('5');
    expect(groupWestern('5000')).toBe('5,000');
    expect(groupWestern('124050')).toBe('124,050');
    expect(groupWestern('12345678')).toBe('12,345,678');
  });

  it('names the fractional unit the way the currency does', () => {
    expect(speakMinor(asMinor(124050), inr)).toBe('1,240 rupees 50 paise');
    expect(speakMinor(asMinor(124050), usd)).toBe('1,240 dollars 50 cents');
  });

  it('formats the live keypad entry in the chosen currency', () => {
    expect(formatEntry('124050', inr)).toBe('₹1,24,050');
    expect(formatEntry('124050', usd)).toBe('$124,050');
  });

  it('follows the active currency when none is given', () => {
    setActiveCurrency(usd);
    expect(formatMinor(asMinor(12405050))).toBe('$124,050.50');
    setActiveCurrency(inr);
    expect(formatMinor(asMinor(12405050))).toBe('₹1,24,050.50');
  });

  it('falls back rather than throwing on a code it does not know', () => {
    // A restored backup could name a currency this build predates.
    expect(toCurrency('JPY').code).toBe('INR');
    expect(toCurrency(null).code).toBe('INR');
    expect(toCurrency('USD').code).toBe('USD');
  });

  it('changes only the display — the stored integer is untouched', () => {
    const stored = asMinor(500000);
    setActiveCurrency(usd);
    const asDollars = formatMinor(stored);
    setActiveCurrency(inr);
    const asRupees = formatMinor(stored);

    expect(asDollars).toBe('$5,000.00');
    expect(asRupees).toBe('₹5,000.00');
    expect(stored).toBe(500000);
  });
});
