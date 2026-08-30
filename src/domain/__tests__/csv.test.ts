import {
  buildRows,
  escapeCsvField,
  EMPTY_MAPPING,
  guessMapping,
  inferDateOrder,
  isMappingComplete,
  parseAmount,
  parseCsv,
  parseCsvDate,
  serialiseCsv,
  summarise,
  UTF8_BOM,
} from '@/domain/csv';

import { AMBIGUOUS_EXPORT, BANK_EXPORT, SHEET_EXPORT } from './fixtures/csv';

const dayOf = (ms: number | null) => (ms === null ? null : new Date(ms).getDate());
const monthOf = (ms: number | null) => (ms === null ? null : new Date(ms).getMonth() + 1);

describe('parseCsv', () => {
  it('keeps a quoted field containing a comma in one piece', () => {
    // The naive split(',') shifts every column after this row, which is exactly
    // the corruption an import must never produce.
    const table = parseCsv(SHEET_EXPORT);
    const swiggy = table.rows.find((row) => row[1] === 'Swiggy');

    expect(swiggy).toEqual(['2026-08-02', 'Swiggy', 'Dinner, ordered late', '24.50', 'HDFC Millennia']);
    expect(table.rows.every((row) => row.length === 5)).toBe(true);
  });

  it('reads the header and every data row', () => {
    const table = parseCsv(SHEET_EXPORT);
    expect(table.headers).toEqual(['date', 'items', 'note', 'amount', 'from']);
    expect(table.rows).toHaveLength(10);
  });

  it('handles escaped quotes, embedded newlines and CRLF', () => {
    const table = parseCsv('a,b\r\n"say ""hi""","two\nlines"\r\n');
    expect(table.rows).toEqual([['say "hi"', 'two\nlines']]);
  });

  it('does not invent a trailing blank row', () => {
    expect(parseCsv('a,b\n1,2\n').rows).toHaveLength(1);
  });
});

describe('guessMapping', () => {
  it('maps the sheet the app exists to replace', () => {
    const mapping = guessMapping(parseCsv(SHEET_EXPORT).headers);
    expect(mapping.date).toBe(0);
    expect(mapping.item).toBe(1);
    expect(mapping.note).toBe(2);
    expect(mapping.amount).toBe(3);
    expect(mapping.account).toBe(4);
    expect(isMappingComplete(mapping)).toBe(true);
  });

  it('maps a bank statement written in a different dialect', () => {
    const mapping = guessMapping(parseCsv(BANK_EXPORT).headers);
    expect(mapping.date).toBe(0);
    expect(mapping.item).toBe(1);
    expect(mapping.amount).toBe(2);
    expect(mapping.account).toBe(3);
  });

  it('never claims one column for two fields', () => {
    const mapping = guessMapping(['date', 'date', 'amount']);
    const used = Object.values(mapping).filter((index): index is number => index !== null);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe('inferDateOrder', () => {
  it('is certain when a component can only be a day', () => {
    expect(inferDateOrder(['15/08/2026', '16/08/2026'])).toEqual({ order: 'dmy', confident: true });
    expect(inferDateOrder(['08/15/2026', '08/16/2026'])).toEqual({ order: 'mdy', confident: true });
  });

  it('is certain about ISO dates', () => {
    expect(inferDateOrder(['2026-08-01', '2026-08-02'])).toEqual({ order: 'ymd', confident: true });
  });

  it('admits when the file cannot settle it', () => {
    // 03/04 could be 3 April or 4 March. Guessing silently files every row in
    // the wrong month; saying so lets the user choose.
    expect(inferDateOrder(['03/04/2026', '05/06/2026'])).toEqual({ order: 'dmy', confident: false });
  });

  it('is not confident about an empty or unreadable sample', () => {
    expect(inferDateOrder([]).confident).toBe(false);
    expect(inferDateOrder(['', '  ']).confident).toBe(false);
  });
});

describe('parseCsvDate', () => {
  it('reads the same text differently depending on the order', () => {
    const dmy = parseCsvDate('03/04/2026', 'dmy');
    const mdy = parseCsvDate('03/04/2026', 'mdy');

    expect([dayOf(dmy), monthOf(dmy)]).toEqual([3, 4]);
    expect([dayOf(mdy), monthOf(mdy)]).toEqual([4, 3]);
  });

  it('reads ISO dates', () => {
    const iso = parseCsvDate('2026-08-24', 'ymd');
    expect([dayOf(iso), monthOf(iso)]).toEqual([24, 8]);
  });

  it('rejects a date that does not exist', () => {
    expect(parseCsvDate('31/02/2026', 'dmy')).toBeNull();
    expect(parseCsvDate('30/02/2028', 'dmy')).toBeNull();
    expect(parseCsvDate('29/02/2028', 'dmy')).not.toBeNull();
    expect(parseCsvDate('13/13/2026', 'dmy')).toBeNull();
    expect(parseCsvDate('not a date', 'dmy')).toBeNull();
  });

  it('lands at midday, so no daylight shift can move the calendar day', () => {
    const at = parseCsvDate('24/08/2026', 'dmy');
    expect(new Date(at!).getHours()).toBe(12);
    expect(dayOf(at)).toBe(24);
  });
});

describe('buildRows', () => {
  const table = parseCsv(SHEET_EXPORT);
  const mapping = guessMapping(table.headers);
  const rows = buildRows(table, mapping, 'ymd');

  it('reports the rows that cannot be imported, without throwing', () => {
    const summary = summarise(rows);
    expect(summary.total).toBe(10);
    // One row has no description, one has an unparseable amount.
    expect(summary.blocked).toBe(2);
    expect(summary.ready).toBe(8);
  });

  it('says what is wrong with each blocked row', () => {
    expect(rows.find((row) => row.rawAmount === 'n/a')?.issues[0]).toMatch(/not a number/);
    expect(rows.find((row) => row.item === '')?.issues[0]).toMatch(/Item is empty/);
  });

  it('parses amounts into paise', () => {
    expect(rows.find((row) => row.item === 'Rent')?.amount).toBe(85000);
    expect(rows.find((row) => row.item === 'Swiggy')?.amount).toBe(2450);
  });

  it('parses each date into an instant', () => {
    const rent = rows.find((row) => row.item === 'Rent');
    expect(monthOf(rent?.occurredAt ?? null)).toBe(8);
    expect(dayOf(rent?.occurredAt ?? null)).toBe(1);
  });

  it('reads the ambiguous file whichever way it is told to', () => {
    const ambiguous = parseCsv(AMBIGUOUS_EXPORT);
    const map = guessMapping(ambiguous.headers);

    const asDmy = buildRows(ambiguous, map, 'dmy');
    const asMdy = buildRows(ambiguous, map, 'mdy');

    expect(monthOf(asDmy[0]!.occurredAt)).toBe(4);
    expect(monthOf(asMdy[0]!.occurredAt)).toBe(3);
  });
});

describe('parseAmount', () => {
  it('discards the sign a spreadsheet writes money out with', () => {
    expect(parseAmount('-1240.50')).toBe(124050);
    expect(parseAmount('₹1,240.50')).toBe(124050);
    expect(parseAmount('n/a')).toBeNull();
  });
});

describe('serialiseCsv', () => {
  it('quotes only what needs quoting', () => {
    expect(escapeCsvField('Rent')).toBe('Rent');
    expect(escapeCsvField('Dinner, late')).toBe('"Dinner, late"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('two\nlines')).toBe('"two\nlines"');
    expect(escapeCsvField(' padded ')).toBe('" padded "');
  });

  it('defuses a field a spreadsheet would execute', () => {
    // This file exists to be opened in Sheets, where =CMD() is not text.
    expect(escapeCsvField('=1+1')).toBe("'=1+1");
    expect(escapeCsvField('+44 phone')).toBe("'+44 phone");
    expect(escapeCsvField('-1')).toBe("'-1");
    expect(escapeCsvField('@handle')).toBe("'@handle");
  });

  it('starts with a BOM and separates rows with CRLF', () => {
    const out = serialiseCsv(['a', 'b'], [['1', '2']]);
    expect(out.startsWith(UTF8_BOM)).toBe(true);
    expect(out).toBe(`${UTF8_BOM}a,b\r\n1,2\r\n`);
  });

  it('round-trips back through the parser', () => {
    const headers = ['date', 'item', 'note', 'amount'];
    const rows = [
      ['2026-08-02', 'Swiggy', 'Dinner, ordered late', '24.50'],
      ['2026-08-03', 'Say "hi"', '', '1.00'],
    ];

    const table = parseCsv(serialiseCsv(headers, rows).replace(UTF8_BOM, ''));
    expect(table.headers).toEqual(headers);
    expect(table.rows).toEqual(rows);
  });
});

describe('export and re-import', () => {
  /**
   * M7's criterion is that the app "exports and re-imports identically". That
   * only holds if the exported headers are ones guessMapping already knows and
   * the dates are written in a form inferDateOrder can settle — so this asserts
   * the shape csv-export.ts writes, not just the serialiser in isolation.
   */
  const HEADERS = [
    'date',
    'item',
    'note',
    'amount',
    'account',
    'category',
    'counts_to_budget',
    'settled',
    'effective',
  ];

  const EXPORTED = [
    ['2026-08-01', 'Monthly rent', '', '3200.00', 'ICICI Bank', 'Housing', '1', '0.00', '3200.00'],
    ['2026-08-02', 'Swiggy', 'Dinner, ordered late', '24.50', 'HDFC Millennia', 'Food', '1', '0.00', '24.50'],
    ['2026-08-03', 'Say "hi"', '', '1.00', 'Cash', 'Other', '1', '0.00', '1.00'],
    ['2026-08-04', '=SUM(A1:A9)', 'looks like a formula', '5.00', 'Cash', 'Other', '1', '0.00', '5.00'],
  ];

  const text = serialiseCsv(HEADERS, EXPORTED);
  const table = parseCsv(text.replace(UTF8_BOM, ''));

  it('needs no mapping from the user', () => {
    const mapping = guessMapping(table.headers);
    expect(table.headers).toEqual(HEADERS);
    expect(isMappingComplete(mapping)).toBe(true);
  });

  it('writes dates the importer can read without being told', () => {
    const mapping = guessMapping(table.headers);
    const dates = table.rows.map((row) => row[mapping.date!] ?? '');
    expect(inferDateOrder(dates)).toEqual({ order: 'ymd', confident: true });
  });

  it('loses no rows and no fields on the way back in', () => {
    const mapping = guessMapping(table.headers);
    const rows = buildRows(table, mapping, 'ymd');

    expect(summarise(rows).blocked).toBe(0);
    expect(rows).toHaveLength(EXPORTED.length);

    const rent = rows.find((row) => row.item === 'Monthly rent');
    expect(rent?.amount).toBe(320000);
    expect(monthOf(rent?.occurredAt ?? null)).toBe(8);
    expect(dayOf(rent?.occurredAt ?? null)).toBe(1);

    // A comma inside a note is the corruption the parser exists to prevent.
    expect(rows.find((row) => row.item === 'Swiggy')?.note).toBe('Dinner, ordered late');
    expect(rows.some((row) => row.item === 'Say "hi"')).toBe(true);
  });

  it('keeps a formula-looking description readable after defusing it', () => {
    const rows = buildRows(table, guessMapping(table.headers), 'ymd');
    const formula = rows.find((row) => row.item.includes('SUM'));

    // The apostrophe is what stops a spreadsheet executing it; the text is still
    // legible, and the row still imports.
    expect(formula?.item).toBe("'=SUM(A1:A9)");
    expect(formula?.issues).toEqual([]);
  });
});
