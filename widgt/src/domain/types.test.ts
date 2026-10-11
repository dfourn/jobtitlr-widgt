import { isStarRating, STAR_RATINGS } from './types';

describe('STAR_RATINGS', () => {
  it('AC-1.2 lists the five ratings in display order, 5 down to 1', () => {
    expect(STAR_RATINGS).toEqual([5, 4, 3, 2, 1]);
  });

  it('AC-1.2 cannot be mutated at runtime', () => {
    expect(Object.isFrozen(STAR_RATINGS)).toBe(true);
  });
});

describe('isStarRating', () => {
  it.each([1, 2, 3, 4, 5])('AC-2.1 accepts %s', (value) => {
    expect(isStarRating(value)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['0', 0],
    ['6', 6],
    ['-1', -1],
    ['a fraction', 4.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a numeric string', '5'],
    ['null', null],
    ['undefined', undefined],
  ])('AC-2.1 rejects %s', (_name, value) => {
    expect(isStarRating(value)).toBe(false);
  });
});
