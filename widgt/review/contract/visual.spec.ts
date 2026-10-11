/**
 * Contract: AC-6 "Visual fidelity" (spec 02, section 5).
 *
 * AC-6.3 only captures evidence. Pixel similarity is a soft signal computed by the review
 * harness (spec 03, section 3) from `review/runs/latest/screenshots/visual-401.png` and
 * `review/reference/widget-reference.png`; it is deliberately not asserted here.
 *
 * DOM hooks: `data-testid="product-rating"`, `data-testid="bar-fill-N"` and `data-testid="bar-track-N"`.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { URLS, VIEWPORT_WIDTHS, openScenario, widgetOf } from './helpers';

const SCREENSHOT_DIR = fileURLToPath(new URL('../runs/latest/screenshots/', import.meta.url));

/** The reference image is 401 x 443 px (docs/brief/README.md). */
const REFERENCE_SIZE = { width: 401, height: 443 } as const;

/** Reads width and height from a PNG's IHDR chunk. */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** Waits for the page to load and for web fonts to be ready, so screenshots are stable. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test.describe('AC-6 visual fidelity', () => {
  test('AC-6.1 the font is Poppins, loaded and served from the app itself', async ({ page, baseURL }) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'font') {
        fontRequests.push(request.url());
      }
    });
    const widget = await openScenario(page, URLS.interactive);

    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        check: document.fonts.check('16px Poppins'),
        loadedFaces: Array.from(document.fonts)
          .filter((face) => face.family.replace(/["']/g, '') === 'Poppins' && face.status === 'loaded')
          .map((face) => face.weight),
      };
    });
    expect(fonts.check).toBe(true);
    // fonts.check() is also true when no Poppins face exists at all, so require a loaded face.
    expect(fonts.loadedFaces.length, 'at least one Poppins face is loaded').toBeGreaterThan(0);

    const families = await widget.evaluate((root) =>
      [root, ...Array.from(root.querySelectorAll('*'))]
        .filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== ''))
        .map((el) => getComputedStyle(el).fontFamily)
        .concat(getComputedStyle(root).fontFamily),
    );
    for (const family of families) {
      expect(family).toMatch(/^["']?Poppins["']?(,|$)/);
    }

    const origin = new URL(baseURL ?? 'http://localhost:4173').origin;
    expect(fontRequests.length, 'Poppins files were requested').toBeGreaterThan(0);
    for (const url of fontRequests) {
      expect(new URL(url).origin, 'fonts are self-hosted (A-W9)').toBe(origin);
    }
  });

  test('AC-6.2 bar colours come from the reference tokens', async ({ page }) => {
    const widget = await openScenario(page, URLS.interactive);
    const fill = widget.getByTestId('bar-fill-5');
    const track = widget.getByTestId('bar-track-5');

    await expect(fill).toHaveCSS('background-color', 'rgb(255, 203, 49)');
    await expect(track).toHaveCSS('background-color', 'rgb(226, 226, 226)');
  });

  test.describe('at the reference width', () => {
    test.use({ viewport: { width: REFERENCE_SIZE.width, height: REFERENCE_SIZE.height } });

    test('AC-6.3 captures the 401px widget for the similarity score', async ({ page }) => {
      await page.goto(URLS.visual);
      await settle(page);

      // Capture first, so the harness always has an image to score, even for a broken render.
      // The reference frame is the top-left 401 x 443 of the page (white page, no margin).
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const file = `${SCREENSHOT_DIR}visual-401.png`;
      await page.screenshot({ path: file, clip: { x: 0, y: 0, ...REFERENCE_SIZE }, animations: 'disabled' });

      const size = pngSize(file);
      expect(Math.abs(size.width - REFERENCE_SIZE.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(size.height - REFERENCE_SIZE.height)).toBeLessThanOrEqual(1);

      const widget = widgetOf(page);
      await expect(widget).toBeVisible();
      const box = await widget.boundingBox();
      expect(box, 'widget has a layout box').not.toBeNull();
      if (box !== null) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, 'the widget fits the 401px frame').toBeLessThanOrEqual(REFERENCE_SIZE.width + 1);
      }
    });
  });

  for (const width of VIEWPORT_WIDTHS) {
    test.describe(`at a ${width}px viewport`, () => {
      test.use({ viewport: { width, height: 900 } });

      test(`AC-6.3 captures a full-page screenshot at ${width}px`, async ({ page }) => {
        await page.goto(URLS.interactive);
        await settle(page);

        mkdirSync(SCREENSHOT_DIR, { recursive: true });
        const file = `${SCREENSHOT_DIR}page-${width}.png`;
        await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });

        // Overflow is judged by AC-5.2; here we only check the capture is at least the viewport wide.
        expect(pngSize(file).width).toBeGreaterThanOrEqual(width);
        await expect(widgetOf(page)).toBeVisible();
      });
    });
  }
});
