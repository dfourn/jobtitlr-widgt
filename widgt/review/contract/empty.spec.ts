/**
 * Contract: AC-2.2 "zero reviews" (spec 02, section 5). The other AC-2 criteria are pure domain
 * rules and are covered by unit tests in `src/domain/`.
 *
 * `/?empty=1` renders the widget with every count at 0.
 * DOM hooks: `data-testid="product-rating"`; `data-testid="star-N"` with `--fill` when stars render.
 */
import { expect, test } from '@playwright/test';
import { URLS, openScenario, readStarFills } from './helpers';

test.describe('AC-2.2 empty state', () => {
  test('AC-2.2 with zero reviews the widget says "No reviews yet"', async ({ page }) => {
    const widget = await openScenario(page, URLS.empty);

    await expect(widget.getByText('No reviews yet', { exact: true })).toBeVisible();
  });

  test('AC-2.2 with zero reviews no NaN or Infinity is rendered', async ({ page }) => {
    const widget = await openScenario(page, URLS.empty);
    await expect(widget.getByText('No reviews yet', { exact: true })).toBeVisible();

    const text = await widget.evaluate((el) => {
      const labels = Array.from(el.querySelectorAll('[aria-label]')).map((node) => node.getAttribute('aria-label') ?? '');
      const styles = Array.from(el.querySelectorAll<HTMLElement>('[style]')).map((node) => node.getAttribute('style') ?? '');
      return [el.textContent ?? '', ...labels, ...styles].join('\n');
    });
    expect(text).not.toMatch(/NaN/);
    expect(text).not.toMatch(/Infinity/);
  });

  test('AC-2.2 with zero reviews no star is filled', async ({ page }) => {
    const widget = await openScenario(page, URLS.empty);
    await expect(widget.getByText('No reviews yet', { exact: true })).toBeVisible();

    // The spec does not say whether the empty state keeps the star row; if it does, every star is empty.
    const fills = await readStarFills(widget);
    expect(fills.every((fill) => fill === 0), `star fills: ${JSON.stringify(fills)}`).toBe(true);
  });
});
