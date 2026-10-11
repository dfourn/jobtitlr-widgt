/**
 * Contract: AC-6 "Visual fidelity" (spec 02, section 5).
 *
 * AC-6.3 only captures evidence. Pixel similarity is a soft signal computed by the review
 * harness (spec 03, section 3): it compares `<run dir>/screenshots/visual-widget.png`, the widget
 * alone in the 360px `?visual=1` wrapper, with the card cropped out of
 * `review/reference/widget-reference.png`, on foreground pixels. It is deliberately not asserted
 * here. Before capturing, the test checks the widget is built from markup rather than a pasted
 * picture of the reference, which the generator is allowed to read. The checks cover the whole
 * page, because the screenshot holds whatever is painted in the widget's box.
 *
 * DOM hooks: `data-testid="product-rating"`, `data-testid="bar-fill-N"` and `data-testid="bar-track-N"`.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { RUN_DIR, URLS, VIEWPORT_WIDTHS, openScenario, widgetOf } from './helpers';

const SCREENSHOT_DIR = `${RUN_DIR}screenshots/`;

/** The reference image is 401 x 443 px (docs/brief/README.md); `?visual=1` is shot at this viewport. */
const REFERENCE_SIZE = { width: 401, height: 443 } as const;

/** `?visual=1` puts the widget in a wrapper exactly this wide (spec 02 section 8): the reference card's width. */
const VISUAL_WRAPPER_WIDTH = 360;

/**
 * The most of the widget's area the feefo logo may cover. The reference logo is about 92 x 22 px,
 * 1.4% of the 360 x 405 card, so this leaves room for padding but not for the one `<img>` to show
 * the reference card, or a large part of it, instead of the logo.
 */
const MAX_LOGO_SHARE = 0.04;

/**
 * Elements that can paint a picture without an `<img>`. None may appear **anywhere** on the
 * `?visual=1` page, not only inside the widget: `widget.screenshot()` captures whatever is painted in
 * the widget's box, including an element or pseudo-element drawn over or behind it.
 */
const PICTURE_ELEMENTS =
  'picture, source, canvas, iframe, object, embed, video, svg image, feImage, pattern, input[type="image"]';

/**
 * Runs in the page. Lists the `PICTURE_ELEMENTS` in the whole document, plus every SVG `<use>` whose
 * href is not a same-document `#fragment` (an external file could carry an image).
 */
function pictureElementsOnPage(selector: string): string[] {
  const reference = (use: Element): string =>
    use.getAttribute('href') ?? use.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '';
  const externalUses = Array.from(document.querySelectorAll('use')).filter((use) => !reference(use).startsWith('#'));
  return [...Array.from(document.querySelectorAll(selector)), ...externalUses].map((el) => el.outerHTML.slice(0, 100));
}

/**
 * Runs in the page. Lists every place in the whole document where CSS could paint a picture: each
 * element and its pseudo-elements, property by property, one line per offence. `cursor` is ignored,
 * because a cursor is not in the screenshot. The rules:
 * - painting properties (`PAINTING`): no `url()` at all;
 * - masks and clips (`ALPHA_ONLY`) carry only alpha, so they cannot reproduce the card's colours:
 *   an SVG made of shapes (a `.svg` file or a `data:image/svg+xml` URI, with no `<image>`,
 *   `<feImage>`, `<foreignObject>` or `data:` URI inside) or a `#id` of a `<mask>` or `<clipPath>`
 *   in the page is allowed;
 * - SVG `fill` and `stroke` (`SVG_PAINT`) may reference a `<linearGradient>` or `<radialGradient>`
 *   in the page by `#id` (a partially filled star), nothing else;
 * - nowhere an `image-set()` or a `paint()` worklet, which can draw arbitrary pixels.
 */
async function cssImagesOnPage(): Promise<string[]> {
  const PAINTING = ['background-image', 'border-image-source', 'list-style-image', 'content', 'filter', 'backdrop-filter'];
  const ALPHA_ONLY = ['mask-image', '-webkit-mask-box-image-source', 'clip-path'];
  const SVG_PAINT = ['fill', 'stroke'];
  const PSEUDOS = [null, '::before', '::after', '::marker', '::first-letter', '::first-line'];
  const here = new URL(location.href);

  const urlsIn = (value: string): string[] =>
    Array.from(value.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi), (match) => match[2] ?? '');

  /** The local name of the element a same-document `#id` URL points at, or `null` for any other URL. */
  const fragmentTarget = (url: string): string | null => {
    const target = new URL(url, document.baseURI);
    const samePage = target.origin === here.origin && target.pathname === here.pathname && target.search === here.search;
    if (!samePage || target.hash.length < 2) return null;
    return document.getElementById(decodeURIComponent(target.hash.slice(1)))?.localName ?? null;
  };

  /** Whether an SVG file or data URI is made of shapes only, so as a mask it carries nothing but alpha. */
  const isShapesOnlySvg = async (url: string): Promise<boolean> => {
    const isSvg = url.toLowerCase().startsWith('data:image/svg+xml') || new URL(url, document.baseURI).pathname.endsWith('.svg');
    if (!isSvg) return false;
    try {
      const text = await (await fetch(url)).text();
      return !/<(?:[\w-]+:)?(?:image|feImage|foreignObject)\b|data:/i.test(text);
    } catch {
      return false;
    }
  };

  const isAllowedMask = async (url: string): Promise<boolean> =>
    ['mask', 'clipPath'].includes(fragmentTarget(url) ?? '') || (await isShapesOnlySvg(url));
  const isAllowedSvgPaint = (url: string): boolean =>
    ['linearGradient', 'radialGradient'].includes(fragmentTarget(url) ?? '');

  const offences: string[] = [];
  for (const el of Array.from(document.querySelectorAll('*'))) {
    const own = getComputedStyle(el);
    for (const pseudo of PSEUDOS) {
      const style = getComputedStyle(el, pseudo);
      // A pseudo-element's value equal to its element's is inherited or repeated: reported once, on the element.
      const valueOf = (property: string): string => {
        const value = style.getPropertyValue(property);
        return pseudo !== null && value === own.getPropertyValue(property) ? '' : value;
      };
      const report = (property: string, value: string, why: string): void => {
        offences.push(`${el.localName}${pseudo ?? ''} ${property}: ${value.slice(0, 100)} (${why})`);
      };
      for (const property of [...PAINTING, ...ALPHA_ONLY, ...SVG_PAINT]) {
        const value = valueOf(property);
        if (/image-set\(|paint\(/i.test(value)) report(property, value, 'image-set() and paint() can draw a picture');
      }
      for (const property of PAINTING) {
        const value = valueOf(property);
        if (urlsIn(value).length > 0) report(property, value, 'an image from a URL');
      }
      for (const property of ALPHA_ONLY) {
        const value = valueOf(property);
        for (const url of urlsIn(value)) {
          if (!(await isAllowedMask(url))) report(property, value, 'masks and clips must be SVG shapes');
        }
      }
      for (const property of SVG_PAINT) {
        const value = valueOf(property);
        for (const url of urlsIn(value)) {
          if (!isAllowedSvgPaint(url)) report(property, value, 'SVG paint may only reference a gradient in the page');
        }
      }
    }
  }
  return offences;
}

/**
 * Runs in the page. Lists the widget or ancestors (up to `<html>`) that are not fully opaque,
 * not visible, or blended with what is behind them: any of these lets something painted behind the
 * widget show through in its screenshot.
 */
function seeThroughAncestors(widget: Element): string[] {
  const found: string[] = [];
  for (let el: Element | null = widget; el !== null; el = el.parentElement) {
    const style = getComputedStyle(el);
    const name = el === widget ? 'the widget' : `<${el.localName}>`;
    if (style.opacity !== '1') found.push(`${name} opacity: ${style.opacity}`);
    if (style.visibility !== 'visible') found.push(`${name} visibility: ${style.visibility}`);
    if (style.mixBlendMode !== 'normal') found.push(`${name} mix-blend-mode: ${style.mixBlendMode}`);
  }
  return found;
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
      // `widget.screenshot()` captures everything painted in the widget's box, so the whole page is checked.
      await expect(widget, 'the widget is visible in ?visual=1').toBeVisible();
      await expect(page.locator('img'), 'the page contains exactly one <img>, the feefo logo').toHaveCount(1);
      const images = widget.locator('img');
      await expect(images, 'the one <img> on the page is inside the widget').toHaveCount(1);
      await expect(images, 'the only <img> is the feefo logo (alt="feefo")').toHaveAttribute('alt', 'feefo');
      const [logoBox, widgetBox] = await Promise.all([images.boundingBox(), widget.boundingBox()]);
      const widgetArea = widgetBox === null ? 0 : widgetBox.width * widgetBox.height;
      const logoArea = logoBox === null ? 0 : logoBox.width * logoBox.height;
      expect(
        widgetArea === 0 ? 1 : logoArea / widgetArea,
        `the feefo logo covers at most ${MAX_LOGO_SHARE * 100}% of the widget, so it cannot be a picture of the card`,
      ).toBeLessThanOrEqual(MAX_LOGO_SHARE);
      expect(
        await page.evaluate(pictureElementsOnPage, PICTURE_ELEMENTS),
        `no ${PICTURE_ELEMENTS} and no external SVG <use> anywhere on the page`,
      ).toEqual([]);
      expect(
        await page.evaluate(cssImagesOnPage),
        'no CSS image anywhere on the page (url() only for SVG-shape masks and clips, or a gradient fill or stroke)',
      ).toEqual([]);
      expect(
        await widget.evaluate(seeThroughAncestors),
        'the widget and its ancestors are opaque, visible and not blended, so nothing behind it shows through',
      ).toEqual([]);
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
