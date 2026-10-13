/**
 * Contract: AC-3 "Accessibility" (spec 02, section 5).
 *
 * DOM hooks: `data-testid="product-rating"` on the widget root and `data-testid="star-N"` on the
 * five big stars (see rendering.spec.ts). Everything else is found by role and accessible name.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  STARS_DESC,
  URLS,
  openScenario,
  readFocusIndicator,
  rowButton,
  rowNamePattern,
  tabIntoWidget,
  writeAxeState,
  type AxeState,
} from './helpers';

const WCAG_22_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

/**
 * @axe-core/playwright 4.13 types its `page` against its own playwright-core (1.64), while the
 * runner is pinned to 1.56. The runtime API it uses is the same, so only the type is bridged.
 */
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]['page'];

/**
 * Runs axe at WCAG 2.2 AA, records the result for `state` (`<RUN_DIR>/axe/<state>.json`, read by
 * the harness's accessibility signal), and returns one readable line per violation.
 */
async function axeViolations(page: Page, state: AxeState): Promise<string[]> {
  const results = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(WCAG_22_AA_TAGS).analyze();
  writeAxeState(state, results.violations);
  return results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} -> ${violation.nodes
        .map((node) => node.target.join(' '))
        .join(', ')}`,
  );
}

test.describe('AC-3 accessibility', () => {
  test('AC-3.1 the widget is a <section> named "Product rating"', async ({ page }) => {
    const widget = await openScenario(page, URLS.interactive);

    await expect(widget).toHaveJSProperty('tagName', 'SECTION');
    await expect(widget).toHaveAccessibleName(/^product rating$/i);
    await expect(page.getByRole('region', { name: /^product rating$/i })).toHaveCount(1);
  });

  test('AC-3.2 the star graphic is hidden from assistive technology', async ({ page }) => {
    const widget = await openScenario(page, URLS.interactive);
    const stars = widget.getByTestId(/^star-[1-5]$/);

    await expect(stars).toHaveCount(5);
    for (const star of await stars.all()) {
      const hidden = await star.evaluate((el) => el.closest('[aria-hidden="true"]') !== null);
      expect(hidden, 'each big star sits inside an aria-hidden subtree').toBe(true);
    }
    // The only image exposed to assistive technology is the feefo logo.
    await expect(widget.getByRole('img')).toHaveCount(1);
  });

  test('AC-3.2 a text alternative "4.6 out of 5" is exposed', async ({ page }) => {
    const widget = await openScenario(page, URLS.interactive);

    expect(await widget.ariaSnapshot()).toMatch(/4\.6 out of 5/i);
  });

  test('AC-3.3 the breakdown is a <ul> of 5 <li> rows', async ({ page }) => {
    const widget = await openScenario(page, URLS.static);
    const list = widget.getByRole('list');

    await expect(list).toHaveCount(1);
    await expect(list).toHaveJSProperty('tagName', 'UL');
    const items = list.getByRole('listitem');
    await expect(items).toHaveCount(5);
    for (const item of await items.all()) {
      await expect(item).toHaveJSProperty('tagName', 'LI');
    }
  });

  test('AC-3.3 static rows are named "N stars: C reviews (P%)"', async ({ page }) => {
    const widget = await openScenario(page, URLS.static);
    const items = widget.getByRole('list').getByRole('listitem');

    await expect(items).toHaveCount(5);
    for (const [index, star] of STARS_DESC.entries()) {
      await expect(items.nth(index)).toHaveAccessibleName(rowNamePattern(star));
    }
  });

  test('AC-3.3 interactive rows are named "N stars: C reviews (P%)", "1 star" in the singular', async ({
    page,
  }) => {
    await openScenario(page, URLS.interactive);

    for (const star of STARS_DESC) {
      await expect(rowButton(page, star)).toHaveCount(1);
    }
    await expect(rowButton(page, 1)).toHaveAccessibleName(/^1 star:/);
  });

  for (const text of ['Excellent', '4.6 out of 5']) {
    test(`AC-3.4 "${text}" is sentence case in the DOM and uppercase through CSS`, async ({ page }) => {
      const widget = await openScenario(page, URLS.interactive);
      const element = widget.getByText(text, { exact: true });

      await expect(element).toBeVisible();
      const { domText, transform } = await element.evaluate((el) => ({
        domText: el.textContent?.trim() ?? '',
        transform: getComputedStyle(el).textTransform,
      }));
      expect(domText).toBe(text);
      expect(domText).not.toBe(domText.toUpperCase());
      expect(transform).toBe('uppercase');
    });
  }

  test('AC-3.5 the logo is an <img alt="feefo">', async ({ page }) => {
    const widget = await openScenario(page, URLS.interactive);
    const logo = widget.getByRole('img', { name: 'feefo' });

    await expect(logo).toHaveCount(1);
    await expect(logo).toHaveJSProperty('tagName', 'IMG');
    await expect(logo).toHaveAttribute('alt', 'feefo');
  });

  test('AC-3.5 the small breakdown stars are decorative', async ({ page }) => {
    const widget = await openScenario(page, URLS.interactive);
    const list = widget.getByRole('list');

    await expect(list).toHaveCount(1);
    await expect(list.getByRole('img')).toHaveCount(0);
    const exposed = await list.evaluate((root) =>
      Array.from(root.querySelectorAll('img, svg'))
        .filter((el) => {
          if (el.closest('[aria-hidden="true"]') !== null) {
            return false;
          }
          if (el.tagName === 'IMG') {
            return el.getAttribute('alt') !== '';
          }
          const role = el.getAttribute('role');
          return role !== 'presentation' && role !== 'none';
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(exposed, 'graphics in the breakdown need alt="" or aria-hidden').toEqual([]);
  });

  test('AC-3.6 axe reports 0 WCAG 2.2 AA violations in the default state', async ({ page }) => {
    await openScenario(page, URLS.interactive);

    expect(await axeViolations(page, 'default')).toEqual([]);
  });

  test('AC-3.6 axe reports 0 WCAG 2.2 AA violations in the static state', async ({ page }) => {
    await openScenario(page, URLS.static);

    expect(await axeViolations(page, 'static')).toEqual([]);
  });

  test('AC-3.6 axe reports 0 WCAG 2.2 AA violations with a row selected', async ({ page }) => {
    await openScenario(page, URLS.interactive);
    const row = rowButton(page, 4);
    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');

    expect(await axeViolations(page, 'selected')).toEqual([]);
  });

  test('AC-3.7 a keyboard-focused row has a visible focus indicator with at least 3:1 contrast', async ({
    page,
  }) => {
    await openScenario(page, URLS.interactive);
    const row = rowButton(page, 5);
    await expect(row).toHaveCount(1);

    const unfocused = await readFocusIndicator(row);
    expect(await tabIntoWidget(page), 'Tab reaches the widget').toBe(true);
    await expect(row).toBeFocused();

    await expect
      .poll(async () => (await readFocusIndicator(row)).visible, {
        message: 'the focused row draws an outline or box-shadow',
      })
      .toBe(true);
    const focused = await readFocusIndicator(row);
    expect(
      `${focused.outline} | ${focused.boxShadow}`,
      'the indicator appears on focus, it is not the resting style',
    ).not.toBe(`${unfocused.outline} | ${unfocused.boxShadow}`);
    expect(focused.contrast, 'indicator contrast against the background behind it').toBeGreaterThanOrEqual(3);
  });
});
