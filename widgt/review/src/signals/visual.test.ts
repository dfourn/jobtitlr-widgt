// @vitest-environment node
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { abs, WIDGT_ROOT } from '../config';
import { blank, cropped, paint, pixel, shifted, stripes } from '../testing/images';
import { collectVisual, compareImages, fitToSize, INK_BELOW, readPng, REFERENCE_CARD, VISUAL_REGIONS, writePng, type RgbaImage } from './visual';

/** A solid-colour image, optionally with a black block in the top-left corner. */
function image(width: number, height: number, rgb: readonly [number, number, number], block = 0): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inBlock = x < block && y < block;
      data.set(inBlock ? [0, 0, 0, 255] : [...rgb, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const white = [255, 255, 255] as const;

describe('AC-L1 visual similarity', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'widgt-visual-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('AC-L1 pads a smaller screenshot with white and says so', () => {
    const { image: fitted, note } = fitToSize(image(4, 4, [0, 0, 0]), 6, 5);
    expect(fitted.width).toBe(6);
    expect(fitted.height).toBe(5);
    expect([...fitted.data.subarray(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...fitted.data.subarray((5 * 6 - 1) * 4)]).toEqual([255, 255, 255, 255]);
    expect(note).toBe('screenshot 4x4 padded to the reference size 6x5');
  });

  it('AC-L1 crops a larger screenshot and says so', () => {
    expect(fitToSize(image(8, 3, white), 6, 5).note).toBe('screenshot 8x3 cropped and padded to the reference size 6x5');
    expect(fitToSize(image(8, 8, white), 6, 5).note).toBe('screenshot 8x8 cropped to the reference size 6x5');
  });

  it('AC-L1 compares PNG files, writes diff.png and maps similarity onto 0-100', () => {
    const screenshot = join(dir, 'visual-widget.png');
    const reference = join(dir, 'reference.png');
    const diff = join(dir, 'out', 'diff.png');
    // 20 of the 100 foreground pixels differ -> 0.80
    writePng(screenshot, paint(blank(360, 405), 100, 100, 10, 8));
    writePng(reference, paint(blank(401, 443), 120, 116, 10, 10)); // the card starts at (20, 16)
    const signal = collectVisual({ screenshot, reference, diff });
    expect(signal.similarity).toBeCloseTo(0.8, 6);
    expect(signal.value).toBe(87.5);
    expect(signal.detail).toBe('foreground similarity 80.0% (20 of 100 foreground pixels differ)');
    expect(existsSync(diff)).toBe(true);
    expect(readPng(diff).width).toBe(360);
  });

  it('AC-L1 reports a size mismatch in the notes', () => {
    const screenshot = join(dir, 'visual-widget.png');
    const reference = join(dir, 'reference.png');
    writePng(screenshot, blank(350, 420));
    writePng(reference, blank(401, 443));
    const signal = collectVisual({ screenshot, reference, diff: join(dir, 'diff.png') });
    expect(signal.notes).toEqual(['screenshot 350x420 cropped and padded to the reference size 360x405']);
  });

  it.each([
    { missing: 'screenshot', detail: 'screenshot not found' },
    { missing: 'reference', detail: 'reference not found' },
  ])('AC-L1 reports a missing $missing instead of throwing', ({ missing, detail }) => {
    const screenshot = join(dir, 'visual-widget.png');
    const reference = join(dir, 'reference.png');
    if (missing !== 'screenshot') writePng(screenshot, image(2, 2, white));
    if (missing !== 'reference') writePng(reference, image(2, 2, white));
    const signal = collectVisual({ screenshot, reference, diff: join(dir, 'diff.png') });
    expect(signal.value).toBeNull();
    expect(signal.detail).toContain(detail);
  });
});

describe('AC-L10 foreground similarity', () => {
  /** A 100x100 white image with a black 10x10 block at (x, y). */
  const block = (x: number, y: number): RgbaImage => paint(blank(100, 100), x, y, 10, 10);

  it('AC-L10 identical foreground on a white background is 100% similar', () => {
    const result = compareImages(block(10, 10), block(10, 10));
    expect(result).toMatchObject({ similarity: 1, differentPixels: 0, foregroundPixels: 100, note: null });
  });

  it('AC-L10 ignores the shared white background: ink in the wrong place scores 0', () => {
    // Whole-frame similarity would be 0.98 here, because 9,800 white pixels match.
    const result = compareImages(block(60, 60), block(10, 10));
    expect(result).toMatchObject({ similarity: 0, differentPixels: 200, foregroundPixels: 200 });
  });

  it('AC-L10 images that differ only in near-white areas are identical', () => {
    const candidate = paint(block(10, 10), 40, 40, 50, 50, [250, 250, 250]);
    const reference = paint(block(10, 10), 0, 60, 40, 40, [246, 246, 246]);
    expect(compareImages(candidate, reference)).toMatchObject({ similarity: 1, differentPixels: 0, foregroundPixels: 100 });
  });

  it('AC-L10 an all-white candidate scores 0 against a card without anti-aliasing', () => {
    const bordered = paint(blank(100, 120, [212, 212, 212]), 1, 1, 98, 118, [255, 255, 255]);
    const reference = paint(bordered, 20, 30, 40, 12);
    const result = compareImages(blank(100, 120), reference);
    expect(result.similarity).toBe(0);
    expect(result.differentPixels).toBe(result.foregroundPixels);
  });

  it('AC-L10 two blank images have no foreground and count as identical', () => {
    expect(compareImages(blank(30, 20), blank(30, 20))).toMatchObject({ similarity: 1, differentPixels: 0, foregroundPixels: 0 });
  });

  describe('anti-aliasing', () => {
    // A black block whose right edge has a one-pixel grey column, as text edges do.
    const reference = paint(paint(blank(60, 60), 20, 20, 20, 20), 40, 20, 1, 20, [128, 128, 128]);
    const candidate = paint(blank(60, 60), 20, 20, 20, 20);
    const at = (x: number, y: number): number => (y * 60 + x) * 4;

    it('AC-L10 pixelmatch 8 leaves anti-aliased pixels transparent in a diff mask and draws real differences', () => {
      const moved = paint(candidate, 50, 50, 2, 2);
      const mask = new Uint8Array(60 * 60 * 4);
      const counted = pixelmatch(moved.data, reference.data, mask, 60, 60, { threshold: 0.1, diffMask: true });
      expect(counted).toBe(4);
      expect(mask[at(40, 30) + 3]).toBe(0);
      expect([...mask.subarray(at(50, 50), at(50, 50) + 4)]).toEqual([255, 0, 0, 255]);
      // The grey column is above the threshold: only the anti-aliasing check forgives it.
      expect(pixelmatch(moved.data, reference.data, null, 60, 60, { threshold: 0.1, includeAA: true })).toBe(24);
    });

    it('AC-L10 forgives an anti-aliased edge the candidate lacks', () => {
      expect(compareImages(candidate, reference)).toMatchObject({ similarity: 1, differentPixels: 0, foregroundPixels: 420 });
    });
  });

  describe('size mismatch (R2)', () => {
    it('AC-L10 a candidate shorter than the card is padded with white and loses similarity in proportion', () => {
      const result = compareImages(stripes(40, 76), stripes(40, 100));
      expect(result.note).toBe('screenshot 40x76 padded to the reference size 40x100');
      expect(result.similarity).toBeCloseTo(0.76, 6);
    });

    it('AC-L10 white padding is not foreground, so it costs nothing where the card is blank too', () => {
      // 13 stripes of 2 rows x 40 pixels in the top 50 rows of both.
      expect(compareImages(stripes(40, 50), stripes(40, 100, 50))).toMatchObject({ similarity: 1, foregroundPixels: 1040 });
    });

    it('AC-L10 a candidate taller than the card is cropped: rows below the card are not compared', () => {
      const result = compareImages(stripes(40, 140), stripes(40, 100));
      expect(result.note).toBe('screenshot 40x140 cropped to the reference size 40x100');
      expect(result.similarity).toBe(1);
    });

    it('AC-L10 a taller candidate whose content starts lower loses the card rows it leaves empty', () => {
      // Stripes from row 24 (a multiple of the 4-row period) cover 38 of the
      // reference's 50 stripe rows; the 12 above them are missing.
      const lower = shifted(stripes(40, 140, 100), 0, 24);
      expect(compareImages(lower, stripes(40, 100)).similarity).toBeCloseTo(0.76, 6);
    });
  });
});

describe('AC-L10 the reference card', () => {
  const realReference = readPng(abs(WIDGT_ROOT, 'review/reference/widget-reference.png'));
  const border = [212, 212, 212, 255];
  const background = [255, 255, 255, 255];
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'widgt-card-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('AC-L10 REFERENCE_CARD sits on the card border of the real reference PNG', () => {
    expect(REFERENCE_CARD).toEqual({ x: 20, y: 16, width: 360, height: 405 });
    expect([realReference.width, realReference.height]).toEqual([401, 443]);
    const { x, y, width, height } = REFERENCE_CARD;
    const right = x + width - 1;
    const bottom = y + height - 1;
    expect(pixel(realReference, x - 1, 200)).toEqual(background);
    expect(pixel(realReference, x, 200)).toEqual(border);
    expect(pixel(realReference, right, 200)).toEqual(border);
    expect(pixel(realReference, right + 1, 200)).toEqual(background);
    expect(pixel(realReference, 200, y - 1)).toEqual(background);
    expect(pixel(realReference, 200, y)).toEqual(border);
    expect(pixel(realReference, 200, bottom)).toEqual(border);
    expect(pixel(realReference, 200, bottom + 1)).toEqual(background);
  });

  it('AC-L10 compares the widget screenshot with the reference cropped to the card', () => {
    const screenshot = join(dir, 'visual-widget.png');
    const diff = join(dir, 'diff.png');
    writePng(screenshot, cropped(realReference, 20, 16, 360, 405));
    const signal = collectVisual({ screenshot, reference: abs(WIDGT_ROOT, 'review/reference/widget-reference.png'), diff });
    expect(signal).toMatchObject({ similarity: 1, value: 100, notes: [] });
    expect([readPng(diff).width, readPng(diff).height]).toEqual([360, 405]);
  });

  it('AC-L10 an all-white widget scores 0 against a card drawn without anti-aliasing', () => {
    const screenshot = join(dir, 'visual-widget.png');
    const reference = join(dir, 'reference.png');
    const card = paint(blank(401, 443, [212, 212, 212]), 21, 17, 358, 403, [255, 255, 255]);
    writePng(reference, paint(card, 120, 60, 160, 20));
    writePng(screenshot, blank(360, 405));
    expect(collectVisual({ screenshot, reference, diff: join(dir, 'diff.png') })).toMatchObject({ similarity: 0, value: 0 });
  });

  it('AC-L10 reports a reference that does not contain the card instead of throwing', () => {
    const screenshot = join(dir, 'visual-widget.png');
    const reference = join(dir, 'reference.png');
    writePng(screenshot, blank(360, 405));
    writePng(reference, blank(100, 100));
    const signal = collectVisual({ screenshot, reference, diff: join(dir, 'diff.png') });
    expect(signal.value).toBeNull();
    expect(signal.detail).toBe('could not compare images: the reference (100x100) does not contain the card box 360x405 at (20, 16)');
  });
});

describe('AC-L10 region diagnostics', () => {
  const referencePath = abs(WIDGT_ROOT, 'review/reference/widget-reference.png');
  const realCard = cropped(readPng(referencePath), 20, 16, 360, 405);
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'widgt-regions-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('AC-L10 names five regions in card coordinates, each holding ink in the real reference', () => {
    expect(VISUAL_REGIONS).toEqual([
      { name: 'label', box: { x: 106, y: 42, width: 145, height: 25 } },
      { name: 'stars', box: { x: 58, y: 81, width: 244, height: 52 } },
      { name: 'score', box: { x: 121, y: 145, width: 115, height: 19 } },
      { name: 'brand', box: { x: 58, y: 178, width: 244, height: 35 } },
      { name: 'rows', box: { x: 18, y: 252, width: 324, height: 134 } },
    ]);
    for (const { name, box } of VISUAL_REGIONS) {
      const region = cropped(realCard, box.x, box.y, box.width, box.height);
      let ink = 0;
      for (let at = 0; at < region.data.length; at += 4) {
        if ((region.data[at] ?? 255) + (region.data[at + 1] ?? 255) + (region.data[at + 2] ?? 255) < INK_BELOW * 3) ink += 1;
      }
      expect(ink, name).toBeGreaterThan(0);
      // The ±8 px search stays inside the card.
      expect(box.x - 8, name).toBeGreaterThanOrEqual(0);
      expect(box.y - 8, name).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width + 8, name).toBeLessThanOrEqual(360);
      expect(box.y + box.height + 8, name).toBeLessThanOrEqual(405);
    }
  });

  it('AC-L10 a copy of the card matches every region at (0, 0)', () => {
    const screenshot = join(dir, 'visual-widget.png');
    writePng(screenshot, realCard);
    const { regions } = collectVisual({ screenshot, reference: referencePath, diff: join(dir, 'diff.png') });
    expect(regions).toEqual(
      ['label', 'stars', 'score', 'brand', 'rows'].map((name) => ({ name, similarity: 1, best: { dx: 0, dy: 0, similarity: 1 } })),
    );
  });

  it('AC-L10 a region shifted by 3 px reports best offset (3, 0) at similarity 1', () => {
    // Blocks of different sizes inside the stars region (card x 58-301, y 81-132), so no other offset fits.
    let card = blank(360, 405);
    for (const [x, y, w, h] of [[70, 90, 12, 30], [100, 95, 30, 8], [150, 88, 5, 35], [200, 100, 40, 20], [260, 92, 18, 18]] as const) {
      card = paint(card, x, y, w, h);
    }
    const reference = join(dir, 'reference.png');
    const screenshot = join(dir, 'visual-widget.png');
    const frame = blank(401, 443);
    for (let y = 0; y < 405; y += 1) frame.data.set(card.data.subarray(y * 360 * 4, (y + 1) * 360 * 4), ((y + 16) * 401 + 20) * 4);
    writePng(reference, frame);
    writePng(screenshot, shifted(card, 3, 0));
    const { regions } = collectVisual({ screenshot, reference, diff: join(dir, 'diff.png') });
    const stars = regions?.find((region) => region.name === 'stars');
    expect(stars?.best).toEqual({ dx: 3, dy: 0, similarity: 1 });
    expect(stars?.similarity).toBeLessThan(1);
    // The other regions are blank in both, so nothing moves there.
    expect(regions?.find((region) => region.name === 'label')).toEqual({ name: 'label', similarity: 1, best: { dx: 0, dy: 0, similarity: 1 } });
  });

  it('AC-L10 has no region diagnostics when the images cannot be compared', () => {
    const signal = collectVisual({ screenshot: join(dir, 'missing.png'), reference: referencePath, diff: join(dir, 'diff.png') });
    expect(signal.regions).toBeNull();
  });
});
