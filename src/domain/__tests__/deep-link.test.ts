import { deepLink, pickScheme } from '../deep-link';

describe('pickScheme', () => {
  it('uses the scheme the running app declares', () => {
    expect(pickScheme('finly-dev')).toBe('finly-dev');
  });

  it('takes the first of several', () => {
    expect(pickScheme(['finly-dev', 'other'])).toBe('finly-dev');
  });

  it('falls back to the production scheme when the app declares none', () => {
    expect(pickScheme(undefined)).toBe('finly');
    expect(pickScheme(null)).toBe('finly');
    expect(pickScheme('')).toBe('finly');
    expect(pickScheme([])).toBe('finly');
  });
});

describe('deepLink', () => {
  it('joins a scheme and a route', () => {
    expect(deepLink('finly-dev', 'expense/new')).toBe('finly-dev://expense/new');
  });

  it('keeps the triple slash the widget uses to open the home screen', () => {
    expect(deepLink('finly', '/')).toBe('finly:///');
  });
});
