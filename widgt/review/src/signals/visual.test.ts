// @vitest-environment node
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectVisual, compareImages, fitToSize, readPng, writePng, type RgbaImage } from './visual';

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

  it('AC-L1 identical images are 100% similar', () => {
    const result = compareImages(image(10, 10, white), image(10, 10, white));
    expect(result).toMatchObject({ similarity: 1, diffPixels: 0, totalPixels: 100, note: null });
  });

  it('AC-L1 counts differing pixels', () => {
    const result = compareImages(image(10, 10, white, 5), image(10, 10, white));
    expect(result.diffPixels).toBe(25);
    expect(result.similarity).toBe(0.75);
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
    const screenshot = join(dir, 'visual-401.png');
    const reference = join(dir, 'reference.png');
    const diff = join(dir, 'out', 'diff.png');
    writePng(screenshot, image(10, 10, white, 4)); // 16 of 100 pixels differ -> 0.84
    writePng(reference, image(10, 10, white));
    const signal = collectVisual({ screenshot, reference, diff });
    expect(signal.similarity).toBeCloseTo(0.84, 6);
    expect(signal.value).toBe(92.5);
    expect(signal.detail).toBe('similarity 84.0% (16 of 100 pixels differ)');
    expect(existsSync(diff)).toBe(true);
    expect(readPng(diff).width).toBe(10);
  });

  it('AC-L1 reports a size mismatch in the notes', () => {
    const screenshot = join(dir, 'visual-401.png');
    const reference = join(dir, 'reference.png');
    writePng(screenshot, image(8, 12, white));
    writePng(reference, image(10, 10, white));
    const signal = collectVisual({ screenshot, reference, diff: join(dir, 'diff.png') });
    expect(signal.notes).toEqual(['screenshot 8x12 cropped and padded to the reference size 10x10']);
  });

  it.each([
    { missing: 'screenshot', detail: 'screenshot not found' },
    { missing: 'reference', detail: 'reference not found' },
  ])('AC-L1 reports a missing $missing instead of throwing', ({ missing, detail }) => {
    const screenshot = join(dir, 'visual-401.png');
    const reference = join(dir, 'reference.png');
    if (missing !== 'screenshot') writePng(screenshot, image(2, 2, white));
    if (missing !== 'reference') writePng(reference, image(2, 2, white));
    const signal = collectVisual({ screenshot, reference, diff: join(dir, 'diff.png') });
    expect(signal.value).toBeNull();
    expect(signal.detail).toContain(detail);
  });
});
