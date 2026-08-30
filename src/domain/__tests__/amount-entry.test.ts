import { appendKey, EMPTY_ENTRY, type KeypadKey } from '@/domain/amount-entry';
import { entryToMinor } from '@/domain/money';

/** Types a sequence of keys from empty, the way a thumb would. */
const type = (keys: string): string =>
  [...keys].reduce<string>((entry, key) => appendKey(entry, key as KeypadKey), EMPTY_ENTRY);

describe('appendKey', () => {
  it('builds up digits', () => {
    expect(type('1')).toBe('1');
    expect(type('1240')).toBe('1240');
  });

  it('treats a leading zero as a placeholder, not a digit', () => {
    expect(type('05')).toBe('5');
    expect(type('0')).toBe('0');
  });

  it('accepts one decimal point and no more', () => {
    expect(type('12.5')).toBe('12.5');
    expect(appendKey('12.5', '.')).toBe('12.5');
    expect(type('.5')).toBe('0.5');
  });

  it('stops at two decimals', () => {
    expect(type('1.99')).toBe('1.99');
    expect(appendKey('1.99', '9')).toBe('1.99');
  });

  it('stops at seven whole digits', () => {
    expect(type('1234567')).toBe('1234567');
    expect(appendKey('1234567', '8')).toBe('1234567');
    // The cap is on the whole part only — decimals still work at the limit.
    expect(appendKey('1234567', '.')).toBe('1234567.');
  });

  it('backspaces one character at a time, and stops at empty', () => {
    expect(appendKey('12.5', 'backspace')).toBe('12.');
    expect(appendKey('12.', 'backspace')).toBe('12');
    expect(appendKey('', 'backspace')).toBe(EMPTY_ENTRY);
  });

  it('produces entries money.ts can read at every intermediate step', () => {
    // Every state a thumb passes through must be a legal amount, not just the
    // final one — the Save button reads the entry on every keystroke.
    const states = [...'1240.50'].reduce<string[]>(
      (all, key) => [...all, appendKey(all[all.length - 1]!, key as KeypadKey)],
      [EMPTY_ENTRY],
    );

    expect(states).toEqual(['', '1', '12', '124', '1240', '1240.', '1240.5', '1240.50']);
    expect(states.map(entryToMinor)).toEqual([0, 100, 1200, 12400, 124000, 124000, 124050, 124050]);
  });
});
