import { initialsOf } from '@/domain/profile';

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
