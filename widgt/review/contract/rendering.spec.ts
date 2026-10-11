/**
 * Contract: AC-1 "Renders the design" (spec 02, section 5).
 *
 * DOM hooks this file relies on (see README.md):
 * - `data-testid="product-rating"` on the widget root.
 * - Bars (AC-1.3): each breakdown row N (1..5) has a track element `data-testid="bar-track-N"`
 *   and, inside it, a fill element `data-testid="bar-fill-N"`. The fill's rendered width divided
 *   by the track's rendered width must equal count / total within ±2 percentage points.
 * - Stars (AC-1.4): each big star is an element `data-testid="star-N"` (N = 1..5, left to right)
 *   carrying the CSS custom property `--fill`, a unitless number in [0, 1]
 *   (for example `style="--fill: 0.6"`), read with getComputedStyle. How the fill is painted
 *   (clip-path, gradient, overlay width) is up to the component.
 * Everything else is found by role, accessible name or visible text.
 */
import { expect, test } from '@playwright/test';
import {
  RATIO_TOLERANCE,
  REFERENCE_COUNTS,
  STARS_DESC,
  URLS,
  openScenario,
  readStarFills,
  shareOf,
  widthRatio,
} from './helpers';

test.describe('AC-1 renders the design', () => {
  test('AC-1.1 shows the label, the score text, the heading and the feefo logo', async ({ page }) => {
    const widget = await openScenario(page, URLS.interactive);

    await expect(widget.getByText('Excellent', { exact: true })).toBeVisible();
    await expect(widget.getByText('4.6 out of 5', { exact: true })).toBeVisible();
    await expect(widget.getByText('Product Rating', { exact: true })).toBeVisible();
    await expect(widget.getByRole('img', { name: 'feefo' })).toBeVisible();
  });

  test('AC-1.2 the breakdown has exactly 5 rows, ordered 5 down to 1, with the reference counts', async ({
    page,
  }) => {
    const widget = await openScenario(page, URLS.interactive);
    const rows = widget.getByRole('list').getByRole('listitem');

    await expect(rows).toHaveCount(5);
    for (const [index, star] of STARS_DESC.entries()) {
      const row = rows.nth(index);
      await expect(row.getByText(String(star), { exact: true })).toBeVisible();
      await expect(row.getByText(String(REFERENCE_COUNTS[star]), { exact: true })).toBeVisible();
    }
  });

  for (const star of STARS_DESC) {
    test(`AC-1.3 the ${star}-star bar fill is that rating's share of the total`, async ({ page }) => {
      const widget = await openScenario(page, URLS.interactive);
      const track = widget.getByTestId(`bar-track-${star}`);
      const fill = widget.getByTestId(`bar-fill-${star}`);

      await expect(track).toBeVisible();
      await expect(track.getByTestId(`bar-fill-${star}`)).toHaveCount(1);
      await expect
        .poll(async () => Math.abs((await widthRatio(fill, track)) - shareOf(star)), {
          message: `bar ${star}: fill/track width should be ${(shareOf(star) * 100).toFixed(1)}% ±2pp`,
        })
        .toBeLessThanOrEqual(RATIO_TOLERANCE);
    });
  }

  test('AC-1.4 the stars are filled [1, 1, 1, 1, 0.6] and the fifth star is 60% filled', async ({
    page,
  }) => {
    const widget = await openScenario(page, URLS.interactive);

    await expect(widget.getByTestId(/^star-[1-5]$/)).toHaveCount(5);
    const fills = await readStarFills(widget);
    expect(fills).toHaveLength(5);
    const expected = [1, 1, 1, 1, 0.6];
    for (const [index, fill] of fills.entries()) {
      expect(fill, `star ${index + 1} --fill`).toBeCloseTo(expected[index] ?? Number.NaN, 2);
    }
  });

  test('AC-1.5 the counts are shown in en-GB number format, in order 5 to 1', async ({ page }) => {
    // The reference data has no count of 1,000 or more, so the thousands separator itself
    // (1232 -> "1,232") is covered by component tests. Here we pin the rendered sequence.
    const widget = await openScenario(page, URLS.interactive);
    const rows = widget.getByRole('list').getByRole('listitem');
    const format = new Intl.NumberFormat('en-GB');

    await expect(rows).toHaveCount(5);
    const expected = ['952', '171', '55', '14', '40'];
    expect(STARS_DESC.map((star) => format.format(REFERENCE_COUNTS[star]))).toEqual(expected);
    for (const [index, count] of expected.entries()) {
      await expect(rows.nth(index).getByText(count, { exact: true })).toBeVisible();
    }
  });
});
