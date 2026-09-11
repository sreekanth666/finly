import { acceptEntry, EMPTY_ENTRY } from '@/domain/amount-entry';
import { entryToMinor } from '@/domain/money';

/** Types characters at the end of the field, one at a time, the way a thumb would. */
const type = (keys: string, from: string = EMPTY_ENTRY): string =>
  [...keys].reduce<string>((entry, key) => acceptEntry(entry, `${entry}${key}`), from);

describe('acceptEntry', () => {
  it('builds up digits', () => {
    expect(type('1')).toBe('1');
    expect(type('1240')).toBe('1240');
  });

  it('treats a leading zero as a placeholder, not a digit', () => {
    expect(type('05')).toBe('5');
    expect(type('0')).toBe('0');
    expect(type('00')).toBe('0');
    expect(type('0.05')).toBe('0.05');
  });

  it('accepts one decimal point', () => {
    expect(type('12.5')).toBe('12.5');
    expect(type('.5')).toBe('0.5');
    expect(type('.')).toBe('0.');
  });

  it('ignores a second point rather than moving the first', () => {
    expect(acceptEntry('12.5', '12.5.')).toBe('12.5');
    // A point typed mid-number would otherwise turn 12.5 into 1.25 unannounced.
    expect(acceptEntry('12.5', '1.2.5')).toBe('12.5');
  });

  it('stops at two decimals', () => {
    expect(type('1.999')).toBe('1.99');
    expect(acceptEntry('1.99', '1.999')).toBe('1.99');
  });

  it('stops at seven whole digits', () => {
    expect(type('12345678')).toBe('1234567');
    expect(acceptEntry('1234567', '12345678')).toBe('1234567');
    // The cap is on the whole part only — decimals still work at the limit.
    expect(type('.5', '1234567')).toBe('1234567.5');
  });

  it('reads a comma as grouping, the way parseMinor does', () => {
    // The system number pad has a comma key, and in an Indian-grouped app a
    // comma is a thousands mark, never a decimal point.
    expect(type('1,500')).toBe('1500');
    expect(acceptEntry(EMPTY_ENTRY, '₹1,24,050.50')).toBe('124050.50');
  });

  it('drops anything that is not part of an amount', () => {
    expect(acceptEntry(EMPTY_ENTRY, '-5')).toBe('5');
    expect(acceptEntry(EMPTY_ENTRY, ' 5 ')).toBe('5');
    expect(acceptEntry(EMPTY_ENTRY, 'AED 12.50')).toBe('12.50');
  });

  it('replaces a selected pre-filled amount with the first key', () => {
    // The field selects its whole value on focus, so typing over a stored
    // budget hands over just the new key. The keypad could only append, which
    // left a pre-filled "5000.00" refusing every digit until it was erased.
    expect(acceptEntry('5000', '8')).toBe('8');
  });

  it('accepts deletions, down to empty', () => {
    expect(acceptEntry('12.5', '12.')).toBe('12.');
    expect(acceptEntry('12', '1')).toBe('1');
    expect(acceptEntry('5', EMPTY_ENTRY)).toBe(EMPTY_ENTRY);
  });

  it('produces entries money.ts can read at every intermediate step', () => {
    // Every state a thumb passes through must be a legal amount, not just the
    // final one — the Save button reads the entry on every keystroke.
    const states = [...'1240.50'].reduce<string[]>(
      (all, key) => {
        const current = all[all.length - 1]!;
        return [...all, acceptEntry(current, `${current}${key}`)];
      },
      [EMPTY_ENTRY],
    );

    expect(states).toEqual(['', '1', '12', '124', '1240', '1240.', '1240.5', '1240.50']);
    expect(states.map(entryToMinor)).toEqual([0, 100, 1200, 12400, 124000, 124000, 124050, 124050]);
  });
});
