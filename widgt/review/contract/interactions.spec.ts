/**
 * Contract: AC-4 "Interactions" (spec 02, section 5, and assumption A-W1).
 *
 * The demo page wires `onRatingSelect` to page state and reports it in the status element
 * (`role="status"`, `data-testid="selection"`), so the callback is observed through the page:
 * "Selected: none", "Selected: N stars", "Selected: 1 star".
 * `/?interactive=0` renders the widget without `onRatingSelect`.
 *
 * AC-4.6 covered by component tests: controlled mode needs a host that owns `selectedRating`,
 * which the demo page does not expose.
 */
import { expect, test } from '@playwright/test';
import {
  STARS_DESC,
  URLS,
  nonColourFingerprint,
  openScenario,
  rowButton,
  selectionText,
  statusOf,
  tabIntoWidget,
  widgetOf,
} from './helpers';

test.describe('AC-4 interactions', () => {
  test('AC-4.1 without onRatingSelect the rows are not buttons', async ({ page }) => {
    const widget = await openScenario(page, URLS.static);

    await expect(widget.getByRole('list').getByRole('listitem')).toHaveCount(5);
    await expect(widget.getByRole('button')).toHaveCount(0);
    await expect(widget.locator('[aria-pressed]')).toHaveCount(0);
  });

  test('AC-4.1 without onRatingSelect nothing in the widget is a tab stop', async ({ page }) => {
    const widget = await openScenario(page, URLS.static);

    const tabbable = await widget.evaluate((root) =>
      Array.from(root.querySelectorAll<HTMLElement>('*'))
        .filter((el) => el.tabIndex >= 0 && !el.hasAttribute('disabled'))
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(tabbable).toEqual([]);
    expect(await tabIntoWidget(page, 6), 'Tab never lands inside the widget').toBe(false);
  });

  test('AC-4.2 with onRatingSelect each row is a <button aria-pressed="false">', async ({ page }) => {
    await openScenario(page, URLS.interactive);

    await expect(widgetOf(page).getByRole('button')).toHaveCount(5);
    for (const star of STARS_DESC) {
      const row = rowButton(page, star);
      await expect(row).toHaveJSProperty('tagName', 'BUTTON');
      await expect(row).toHaveAttribute('aria-pressed', 'false');
    }
    await expect(statusOf(page)).toHaveRole('status');
    await expect(statusOf(page)).toHaveText(selectionText(null));
  });

  test('AC-4.2 clicking an unselected row selects it and reports the rating', async ({ page }) => {
    await openScenario(page, URLS.interactive);
    const row = rowButton(page, 5);

    await row.click();

    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await expect(statusOf(page)).toHaveText(selectionText(5));
  });

  test('AC-4.3 clicking the selected row again clears the selection', async ({ page }) => {
    await openScenario(page, URLS.interactive);
    const row = rowButton(page, 3);

    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await row.click();

    await expect(row).toHaveAttribute('aria-pressed', 'false');
    await expect(statusOf(page)).toHaveText(selectionText(null));
    await expect(widgetOf(page).getByRole('button', { pressed: true })).toHaveCount(0);
  });

  test('AC-4.4 selecting another row moves the selection, only one row is ever pressed', async ({
    page,
  }) => {
    await openScenario(page, URLS.interactive);
    const pressed = widgetOf(page).getByRole('button', { pressed: true });

    await rowButton(page, 5).click();
    await expect(pressed).toHaveCount(1);

    await rowButton(page, 2).click();
    await expect(pressed).toHaveCount(1);
    await expect(rowButton(page, 2)).toHaveAttribute('aria-pressed', 'true');
    await expect(rowButton(page, 5)).toHaveAttribute('aria-pressed', 'false');
    await expect(statusOf(page)).toHaveText(selectionText(2));

    await rowButton(page, 1).click();
    await expect(pressed).toHaveCount(1);
    await expect(statusOf(page)).toHaveText(selectionText(1));
  });

  test('AC-4.5 Tab reaches the rows in order 5 to 1', async ({ page }) => {
    await openScenario(page, URLS.interactive);

    expect(await tabIntoWidget(page), 'Tab reaches the widget').toBe(true);
    for (const [index, star] of STARS_DESC.entries()) {
      if (index > 0) {
        await page.keyboard.press('Tab');
      }
      await expect(rowButton(page, star)).toBeFocused();
    }
  });

  test('AC-4.5 Enter toggles the focused row', async ({ page }) => {
    await openScenario(page, URLS.interactive);
    const row = rowButton(page, 5);

    expect(await tabIntoWidget(page), 'Tab reaches the widget').toBe(true);
    await expect(row).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await expect(statusOf(page)).toHaveText(selectionText(5));

    await page.keyboard.press('Enter');
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    await expect(statusOf(page)).toHaveText(selectionText(null));
  });

  test('AC-4.5 Space toggles the focused row', async ({ page }) => {
    await openScenario(page, URLS.interactive);
    const row = rowButton(page, 4);

    expect(await tabIntoWidget(page), 'Tab reaches the widget').toBe(true);
    await page.keyboard.press('Tab');
    await expect(row).toBeFocused();

    await page.keyboard.press('Space');
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await expect(statusOf(page)).toHaveText(selectionText(4));

    await page.keyboard.press('Space');
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    await expect(statusOf(page)).toHaveText(selectionText(null));
  });

  // AC-4.6 covered by component tests

  test('AC-4.7 a selected row looks different without relying on colour alone', async ({ page }) => {
    await openScenario(page, URLS.interactive);
    const row = rowButton(page, 5);
    await expect(row).toHaveCount(1);
    // Compare the same row at rest: no hover, no focus, so only the selection differs.
    await page.mouse.move(0, 0);
    const before = await nonColourFingerprint(row);

    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await row.evaluate((el) => {
      if (el instanceof HTMLElement) {
        el.blur();
      }
    });
    await page.mouse.move(0, 0);

    await expect
      .poll(async () => (await nonColourFingerprint(row)) !== before, {
        message:
          'selection changes something other than colour (font weight, border, outline, shadow, icon or size)',
      })
      .toBe(true);
  });
});
