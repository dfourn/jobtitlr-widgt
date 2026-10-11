import { DEFAULT_LOCALE, formatCount, formatPercent } from './format';

const NBSP = ' ';

describe('formatCount', () => {
  it.each<[number, string, string]>([
    [1232, 'en-GB', '1,232'],
    [952, 'en-GB', '952'],
    [0, 'en-GB', '0'],
    [1234567, 'en-GB', '1,234,567'],
    [1232, 'de-DE', '1.232'],
  ])('AC-1.5 formats %s for %s as "%s"', (count, locale, expected) => {
    expect(formatCount(count, locale)).toBe(expected);
  });

  it('AC-1.5 defaults to en-GB (A-W11)', () => {
    expect(DEFAULT_LOCALE).toBe('en-GB');
    expect(formatCount(1232)).toBe('1,232');
  });
});

describe('formatPercent', () => {
  it.each<[number, string, string]>([
    [952 / 1232, 'en-GB', '77.3%'],
    [171 / 1232, 'en-GB', '13.9%'],
    [1, 'en-GB', '100%'],
    [0, 'en-GB', '0%'],
    [952 / 1232, 'de-DE', `77,3${NBSP}%`],
  ])('AC-1.3 formats a share of %s for %s as "%s"', (share, locale, expected) => {
    expect(formatPercent(share, locale)).toBe(expected);
  });

  it('AC-1.3 defaults to en-GB (A-W11)', () => {
    expect(formatPercent(0.5)).toBe('50%');
  });
});
