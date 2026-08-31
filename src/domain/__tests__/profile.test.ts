import { greetingFor, initialsOf } from '@/domain/profile';

/** Local-time constructor, so a test never has to reason about the zone offset. */
const at = (hour: number, minute = 0): number =>
  new Date(2026, 7, 31, hour, minute).getTime();

describe('initialsOf', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsOf('Sreekanth Kumar')).toBe('SK');
  });

  it('stops at two, however many names there are', () => {
    expect(initialsOf('Sreekanth Kumar Nair')).toBe('SK');
  });

  it('gives one letter for one word', () => {
    expect(initialsOf('Sreekanth')).toBe('S');
  });

  it('ignores the spacing someone actually typed', () => {
    expect(initialsOf('   sreekanth    kumar   ')).toBe('SK');
  });

  it('is null when there is nothing to take an initial from', () => {
    expect(initialsOf('')).toBeNull();
    expect(initialsOf('   ')).toBeNull();
  });

  /* The avatar is the one place a name is rendered character by character, so
     it is the one place a surrogate pair can be cut in half. */
  it('takes whole code points, not code units', () => {
    expect(initialsOf('𝕊am')).toBe('𝕊');
  });

  it('leaves a script without cases alone', () => {
    expect(initialsOf('ശ്രീകാന്ത്')).toBe('ശ');
  });
});

describe('greetingFor', () => {
  it('reads the local hour, at every boundary', () => {
    expect(greetingFor(at(0))).toBe('Good morning');
    expect(greetingFor(at(11, 59))).toBe('Good morning');
    expect(greetingFor(at(12))).toBe('Good afternoon');
    expect(greetingFor(at(16, 59))).toBe('Good afternoon');
    expect(greetingFor(at(17))).toBe('Good evening');
    expect(greetingFor(at(23, 59))).toBe('Good evening');
  });

  it('defaults to now, so a caller need not hold a clock', () => {
    expect(greetingFor()).toBe(greetingFor(Date.now()));
  });
});
