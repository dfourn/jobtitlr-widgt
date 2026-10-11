/**
 * Contract: AC-6 "Visual fidelity" (spec 02, section 5).
 *
 * AC-6.3 only captures evidence. Pixel similarity is a soft signal computed by the review
 * harness (spec 03, section 3): it compares `<run dir>/screenshots/visual-widget.png`, the widget
 * alone in the 360px `?visual=1` wrapper, with the card cropped out of
 * `review/reference/widget-reference.png`, on foreground pixels. It is deliberately not asserted
 * here. Before capturing, the test checks the widget is built from markup rather than a pasted
 * picture of the reference, which the generator is allowed to read.
 *
 * DOM hooks: `data-testid="product-rating"`, `data-testid="bar-fill-N"` and `data-testid="bar-track-N"`.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { RUN_DIR, URLS, VIEWPORT_WIDTHS, openScenario, widgetOf } from './helpers';

const SCREENSHOT_DIR = `${RUN_DIR}screenshots/`;

/** The reference image is 401 x 443 px (docs/brief/README.md); `?visual=1` is shot at this viewport. */
const REFERENCE_SIZE = { width: 401, height: 443 } as const;

/** `?visual=1` puts the widget in a wrapper exactly this wide (spec 02 section 8): the reference card's width. */
const VISUAL_WRAPPER_WIDTH = 360;

/** Elements that can paint a picture without an `<img>`. */
const PICTURE_ELEMENTS = 'canvas, iframe, object, embed, video, svg image, feImage, input[type="image"]';

/**
 * Lists every place inside `widget` (itself included, with its `::before` and `::after`) where CSS
 * paints an image from a URL: `background-image`, `border-image-source`, `list-style-image` or
 * generated `content`. Gradients are fine; `url()` and `image-set()` are not.
 */
async function cssImages(widget: Locator): Promise<string[]> {
  return widget.evaluate((root) => {
    const found: string[] = [];
    const properties = ['background-image', 'border-image-source', 'list-style-image', 'content'];
    for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(el, pseudo);
        for (const property of properties) {
          const value = style.getPropertyValue(property);
          if (/url\(|image-set\(/i.test(value)) {
            found.push(`${el.tagName.toLowerCase()}${pseudo ?? ''} ${property}: ${value.slice(0, 80)}`);
          }
        }
      }
    }
    return found;
  });
}

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

    test('AC-6.3 captures the widget in its 360px wrapper for the similarity score', async ({ page }) => {
      await page.goto(URLS.visual);
      await settle(page);
      const widget = widgetOf(page);

      // Guards first: the score must come from markup and CSS, not from a picture of the reference.
      await expect(widget, 'the widget is visible in ?visual=1').toBeVisible();
      const images = widget.locator('img');
      await expect(images, 'the widget contains exactly one <img>, the feefo logo').toHaveCount(1);
      await expect(images, 'the only <img> in the widget is the feefo logo (alt="feefo")').toHaveAttribute(
        'alt',
        'feefo',
      );
      expect(await cssImages(widget), 'no CSS url() or image-set() images inside the widget').toEqual([]);
      const pictures = await widget.evaluate(
        (root, selector) => Array.from(root.querySelectorAll(selector)).map((el) => el.outerHTML.slice(0, 80)),
        PICTURE_ELEMENTS,
      );
      expect(pictures, `no ${PICTURE_ELEMENTS} inside the widget`).toEqual([]);
      const visualTree = await widget.ariaSnapshot();
      const staticPage = await page.context().newPage();
      const staticTree = await (await openScenario(staticPage, URLS.static)).ariaSnapshot();
      await staticPage.close();
      expect(visualTree, 'the widget in ?visual=1 has the same accessibility tree as on /?interactive=0').toBe(
        staticTree,
      );

      // The widget alone is what the harness scores; the 401 x 443 frame is kept for people.
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const widgetFile = `${SCREENSHOT_DIR}visual-widget.png`;
      await widget.screenshot({ path: widgetFile, animations: 'disabled' });
      const frameFile = `${SCREENSHOT_DIR}visual-401.png`;
      await page.screenshot({ path: frameFile, clip: { x: 0, y: 0, ...REFERENCE_SIZE }, animations: 'disabled' });

      const frame = pngSize(frameFile);
      expect(Math.abs(frame.width - REFERENCE_SIZE.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(frame.height - REFERENCE_SIZE.height)).toBeLessThanOrEqual(1);

      // Spec 02 section 8: a wrapper exactly 360px wide on a page with no margin, the widget inside it.
      const layout = await widget.evaluate((el) => {
        const wrapper = el.parentElement?.getBoundingClientRect() ?? null;
        const box = el.getBoundingClientRect();
        return {
          wrapper: wrapper === null ? null : { left: wrapper.left, width: wrapper.width },
          widget: { left: box.left, right: box.right },
        };
      });
      expect(layout.wrapper, 'the widget has a wrapper').not.toBeNull();
      if (layout.wrapper !== null) {
        expect(
          Math.abs(layout.wrapper.width - VISUAL_WRAPPER_WIDTH),
          `the ?visual=1 wrapper is ${VISUAL_WRAPPER_WIDTH}px wide`,
        ).toBeLessThanOrEqual(1);
        expect(layout.widget.left, 'the widget starts inside its wrapper').toBeGreaterThanOrEqual(layout.wrapper.left - 1);
        expect(layout.widget.right, 'the widget ends inside its wrapper').toBeLessThanOrEqual(
          layout.wrapper.left + layout.wrapper.width + 1,
        );
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
