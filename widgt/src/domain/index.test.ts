import * as domain from './index';

describe('domain barrel', () => {
  it('AC-7.3 exposes the whole runtime API of the domain layer from one entry point', () => {
    expect(Object.keys(domain).sort()).toEqual([
      'DEFAULT_LOCALE',
      'STAR_RATINGS',
      'averageOf',
      'defaultLabelFor',
      'formatCount',
      'formatPercent',
      'isStarRating',
      'roundScore',
      'shareOf',
      'starFills',
      'summarise',
      'totalOf',
      'validateCounts',
    ]);
  });
});
