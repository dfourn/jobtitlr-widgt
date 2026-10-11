/**
 * Contract: AC-5 "Responsive" (spec 02, section 5, and assumption A-W8).
 *
 * DOM hooks: `data-testid="product-rating"` on the widget root. Rows are found by role.
 * The viewport is set per test with `test.use`, so the config needs only one project.
 */
import { expect, test } from '@playwright/test';
import {
  REFERENCE_COUNTS,
  STARS_DESC,
  URLS,
  VIEWPORT_WIDTHS,
  findLayoutProblems,
  openScenario,
} from './helpers';

const VIEWPORT_HEIGHT = 900;

for (const width of VIEWPORT_WIDTHS) {
  test.describe(`at a ${width}px viewport`, () => {
    test.use({ viewport: { width, height: VIEWPORT_HEIGHT } });

    test(`AC-5.2 ${width}px: the page does not scroll horizontally`, async ({ page }) => {
      await openScenario(page, URLS.interactive);

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test(`AC-5.2 ${width}px: no text in the widget is clipped, outside the widget or overlapping`, async ({
      page,
    }) => {
      const widget = await openScenario(page, URLS.interactive);

      expect(await findLayoutProblems(widget)).toEqual([]);
    });

    test(`AC-5.2 ${width}px: all 5 rows are visible`, async ({ page }) => {
      const widget = await openScenario(page, URLS.interactive);
      const rows = widget.getByRole('list').getByRole('listitem');

      await expect(rows).toHaveCount(5);
      for (const row of await rows.all()) {
        await expect(row).toBeVisible();
        const box = await row.boundingBox();
        expect(box, 'row has a layout box').not.toBeNull();
        if (box !== null) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
        }
      }
    });

    test(`AC-5.1 ${width}px: the widget fills its container up to a 420px maximum`, async ({ page }) => {
      const widget = await openScenario(page, URLS.interactive);

      const { widgetWidth, containerWidth } = await widget.evaluate((el) => {
        const parent = el.parentElement;
        const parentStyle = parent === null ? null : getComputedStyle(parent);
        const content =
          parent === null || parentStyle === null
            ? 0
            : parent.clientWidth -
              Number.parseFloat(parentStyle.paddingLeft) -
              Number.parseFloat(parentStyle.paddingRight);
        return { widgetWidth: el.getBoundingClientRect().width, containerWidth: content };
      });
      expect(widgetWidth).toBeLessThanOrEqual(420);
      expect(Math.abs(widgetWidth - Math.min(containerWidth, 420)), 'widget width = min(container, 420px)').toBeLessThanOrEqual(1);
    });
  });
}

test.describe('at a 1280px viewport', () => {
  test.use({ viewport: { width: 1280, height: VIEWPORT_HEIGHT } });

  test('AC-5.1 1280px: the widget is at most 420px wide and centred', async ({ page }) => {
    const widget = await openScenario(page, URLS.interactive);
    const box = await widget.boundingBox();
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(box, 'widget has a layout box').not.toBeNull();
    if (box !== null) {
      expect(box.width).toBeLessThanOrEqual(420);
      const leftGap = box.x;
      const rightGap = viewportWidth - (box.x + box.width);
      expect(Math.abs(leftGap - rightGap), 'left and right gaps match within 2px').toBeLessThanOrEqual(2);
    }
  });
});

test.describe('at a 320px viewport', () => {
  test.use({ viewport: { width: 320, height: VIEWPORT_HEIGHT } });

  test('AC-5.3 the widget is a size container, so it adapts to the space it is given', async ({ page }) => {
    const widget = await openScenario(page, URLS.interactive);

    const containers = await widget.evaluate((root) =>
      [root, ...Array.from(root.querySelectorAll('*'))].filter((el) => {
        const type = getComputedStyle(el).containerType;
        return type === 'inline-size' || type === 'size';
      }).length,
    );
    expect(containers, 'the widget root or a descendant sets container-type').toBeGreaterThan(0);
  });

  test('AC-5.3 at narrow widths the counts stay visible', async ({ page }) => {
    const widget = await openScenario(page, URLS.interactive);
    const rows = widget.getByRole('list').getByRole('listitem');

    await expect(rows).toHaveCount(5);
    for (const [index, star] of STARS_DESC.entries()) {
      const count = rows.nth(index).getByText(String(REFERENCE_COUNTS[star]), { exact: true });
      await expect(count).toBeInViewport({ ratio: 1 });
    }
  });
});

test.describe('text zoom', () => {
  // AC-5.4 is only partly automatable. Browser zoom itself cannot be driven from Playwright,
  // so "stays usable at 200% zoom" remains a manual check (Ctrl/Cmd + to 200% in Chrome).
  // What is automated: text sizes follow the root font size, which is only true for relative
  // units (rem/em). Doubling the root size must grow the text by well over 1.5x.
  test('AC-5.4 text sizes are relative: doubling the root font size enlarges the text', async ({ page }) => {
    const widget = await openScenario(page, URLS.interactive);
    const samples = [
      widget.getByText('Excellent', { exact: true }),
      widget.getByText('4.6 out of 5', { exact: true }),
      widget.getByText('Product Rating', { exact: true }),
      widget.getByText(String(REFERENCE_COUNTS[5]), { exact: true }),
    ];
    const fontSize = async (): Promise<number[]> =>
      Promise.all(samples.map((sample) => sample.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))));

    const before = await fontSize();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const after = await fontSize();

    for (const [index, size] of before.entries()) {
      expect(after[index] ?? 0, `sample ${index + 1} grows with the root font size`).toBeGreaterThan(size * 1.5);
    }
  });
});
