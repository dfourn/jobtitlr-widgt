import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, sep } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { visualScore } from '../score';
import type { RegionDiagnostic } from '../types';

/** An RGBA bitmap, 4 bytes per pixel, row-major. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

const WHITE = [255, 255, 255, 255] as const;

/** A rectangle in pixels. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The widget card inside the reference PNG (401x443): its #d4d4d4 border runs
 * from x 20 to 379 and y 16 to 420. The widget screenshot is compared with
 * this crop (AC-L10).
 */
export const REFERENCE_CARD: Box = { x: 20, y: 16, width: 360, height: 405 };

/** Copies `box` out of `image`. Throws a RangeError when the box does not fit. */
export function crop(image: RgbaImage, box: Box, name = 'the image'): RgbaImage {
  if (box.x < 0 || box.y < 0 || box.x + box.width > image.width || box.y + box.height > image.height) {
    throw new RangeError(
      `${name} (${String(image.width)}x${String(image.height)}) does not contain the card box ` +
        `${String(box.width)}x${String(box.height)} at (${String(box.x)}, ${String(box.y)})`,
    );
  }
  const data = new Uint8Array(box.width * box.height * 4);
  for (let y = 0; y < box.height; y += 1) {
    const start = ((box.y + y) * image.width + box.x) * 4;
    data.set(image.data.subarray(start, start + box.width * 4), y * box.width * 4);
  }
  return { width: box.width, height: box.height, data };
}

/**
 * Crops and/or pads `image` to `width` x `height`, anchored top-left, padding
 * with white (the `?visual=1` page background). Returns a note describing the
 * change, or `null` when the size already matched.
 */
export function fitToSize(image: RgbaImage, width: number, height: number): { image: RgbaImage; note: string | null } {
  if (image.width === width && image.height === height) return { image, note: null };
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;
      if (x < image.width && y < image.height) {
        const source = (y * image.width + x) * 4;
        data.set(image.data.subarray(source, source + 4), target);
      } else {
        data.set(WHITE, target);
      }
    }
  }
  const changes = [
    image.width > width || image.height > height ? 'cropped' : '',
    image.width < width || image.height < height ? 'padded' : '',
  ].filter((c) => c !== '');
  const note = `screenshot ${String(image.width)}x${String(image.height)} ${changes.join(' and ')} to the reference size ${String(width)}x${String(height)}`;
  return { image: { width, height, data }, note };
}

/** pixelmatch's colour threshold (its default): the maximum OKLab distance of two equal pixels. */
const PIXELMATCH_THRESHOLD = 0.1;

/**
 * A pixel is ink (foreground) when the mean of its red, green and blue is
 * below this. Near-white pixels, such as the page and card background, are not.
 */
export const INK_BELOW = 245;

function isInk(data: Uint8Array, at: number): boolean {
  return (data[at] ?? 255) + (data[at + 1] ?? 255) + (data[at + 2] ?? 255) < INK_BELOW * 3;
}

export interface ForegroundComparison {
  /**
   * 1 - differentPixels / foregroundPixels. Two images without any foreground
   * are identical, so they score 1.
   */
  readonly similarity: number;
  /** Foreground pixels pixelmatch counts as different (anti-aliasing forgiven). */
  readonly differentPixels: number;
  /** Pixels that are ink in either image (the union). */
  readonly foregroundPixels: number;
}

/**
 * Foreground similarity of two images of the same size (AC-L10). pixelmatch
 * (threshold 0.1, anti-aliasing detection on) marks differing pixels in a diff
 * mask; with `diffMask` it leaves anti-aliased pixels transparent, so they are
 * forgiven. Only pixels that are ink in either image are counted, so a shared
 * white background neither helps nor hurts.
 */
export function foregroundSimilarity(candidate: RgbaImage, reference: RgbaImage): ForegroundComparison {
  const { width, height } = reference;
  if (candidate.width !== width || candidate.height !== height) {
    throw new RangeError(
      `images differ in size: ${String(candidate.width)}x${String(candidate.height)} vs ${String(width)}x${String(height)}`,
    );
  }
  const mask = new Uint8Array(width * height * 4);
  pixelmatch(candidate.data, reference.data, mask, width, height, { threshold: PIXELMATCH_THRESHOLD, diffMask: true });
  let foregroundPixels = 0;
  let differentPixels = 0;
  for (let at = 0; at < mask.length; at += 4) {
    if (!isInk(candidate.data, at) && !isInk(reference.data, at)) continue;
    foregroundPixels += 1;
    if ((mask[at + 3] ?? 0) > 0) differentPixels += 1;
  }
  return {
    similarity: foregroundPixels === 0 ? 1 : 1 - differentPixels / foregroundPixels,
    differentPixels,
    foregroundPixels,
  };
}

export interface ImageComparison extends ForegroundComparison {
  /** pixelmatch's diff image, for people: differences red, anti-aliasing yellow. */
  readonly diff: RgbaImage;
  readonly note: string | null;
}

/**
 * Compares a screenshot with the reference on foreground pixels (AC-L10),
 * after fitting the screenshot to the reference size ({@link fitToSize}).
 */
export function compareImages(actual: RgbaImage, reference: RgbaImage): ImageComparison {
  const fitted = fitToSize(actual, reference.width, reference.height);
  const diff = new Uint8Array(reference.width * reference.height * 4);
  pixelmatch(fitted.image.data, reference.data, diff, reference.width, reference.height, { threshold: PIXELMATCH_THRESHOLD });
  return {
    ...foregroundSimilarity(fitted.image, reference),
    diff: { width: reference.width, height: reference.height, data: diff },
    note: fitted.note,
  };
}

/** A named part of the reference card, in card coordinates. */
export interface VisualRegion {
  readonly name: string;
  readonly box: Box;
}

/**
 * The parts of the card the diagnostics look at: the reference's ink bands
 * with a 4 px margin (AC-L10). Each leaves room for the offset search.
 */
export const VISUAL_REGIONS: readonly VisualRegion[] = [
  { name: 'label', box: { x: 106, y: 42, width: 145, height: 25 } },
  { name: 'stars', box: { x: 58, y: 81, width: 244, height: 52 } },
  { name: 'score', box: { x: 121, y: 145, width: 115, height: 19 } },
  { name: 'brand', box: { x: 58, y: 178, width: 244, height: 35 } },
  { name: 'rows', box: { x: 18, y: 252, width: 324, height: 134 } },
];

/** How far, in px, the region diagnostics search for a better fit in each direction. */
export const REGION_SEARCH = 8;

/** The `width` x `height` window of `image` at (x, y); pixels outside `image` are white. */
function windowAt(image: RgbaImage, x: number, y: number, width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4).fill(255);
  const left = Math.max(0, x);
  const right = Math.min(image.width, x + width);
  if (right > left) {
    for (let row = Math.max(0, y); row < Math.min(image.height, y + height); row += 1) {
      const start = (row * image.width + left) * 4;
      data.set(image.data.subarray(start, start + (right - left) * 4), ((row - y) * width + (left - x)) * 4);
    }
  }
  return { width, height, data };
}

/**
 * Per-region diagnostics (AC-L10, not scored): each region's foreground
 * similarity at the reference position, and the offset within
 * ±{@link REGION_SEARCH} px where the candidate matches it best. `candidate`
 * must already have the card's size.
 */
export function regionDiagnostics(
  candidate: RgbaImage,
  card: RgbaImage,
  regions: readonly VisualRegion[] = VISUAL_REGIONS,
  search = REGION_SEARCH,
): RegionDiagnostic[] {
  return regions.map(({ name, box }) => {
    const target = windowAt(card, box.x, box.y, box.width, box.height);
    const at = (dx: number, dy: number): number =>
      foregroundSimilarity(windowAt(candidate, box.x + dx, box.y + dy, box.width, box.height), target).similarity;
    const similarity = at(0, 0);
    let best = { dx: 0, dy: 0, similarity };
    for (let dy = -search; dy <= search; dy += 1) {
      for (let dx = -search; dx <= search; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const value = at(dx, dy);
        const closer = Math.abs(dx) + Math.abs(dy) < Math.abs(best.dx) + Math.abs(best.dy);
        if (value > best.similarity || (value === best.similarity && closer)) best = { dx, dy, similarity: value };
      }
    }
    return { name, similarity, best };
  });
}

/** Reads a PNG file into an {@link RgbaImage}. */
export function readPng(path: string): RgbaImage {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

/** Writes an {@link RgbaImage} as a PNG file, creating the folder. */
export function writePng(path: string, image: RgbaImage): void {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
}

export interface VisualSignal {
  readonly value: number | null;
  readonly similarity: number | null;
  readonly detail: string;
  readonly notes: readonly string[];
  /** Region diagnostics, or `null` when the images could not be compared. */
  readonly regions: readonly RegionDiagnostic[] | null;
}

/**
 * The visual signal (AC-L10): compares the widget screenshot with the
 * reference cropped to {@link REFERENCE_CARD} on foreground pixels, writes the
 * card's `diff.png`, and maps similarity onto 0-100. Missing or unreadable
 * images produce `null` with a reason instead of throwing.
 */
export function collectVisual(
  paths: { readonly screenshot: string; readonly reference: string; readonly diff: string },
  displayRoot: string | null = null,
): VisualSignal {
  const show = (path: string): string => (displayRoot === null ? path : relative(displayRoot, path).split(sep).join('/'));
  if (!existsSync(paths.reference)) {
    return { value: null, similarity: null, detail: `reference not found: ${show(paths.reference)}`, notes: [], regions: null };
  }
  if (!existsSync(paths.screenshot)) {
    return { value: null, similarity: null, detail: `screenshot not found: ${show(paths.screenshot)}`, notes: [], regions: null };
  }
  try {
    const card = crop(readPng(paths.reference), REFERENCE_CARD, 'the reference');
    const screenshot = readPng(paths.screenshot);
    const result = compareImages(screenshot, card);
    writePng(paths.diff, result.diff);
    return {
      value: visualScore(result.similarity),
      similarity: result.similarity,
      detail: `foreground similarity ${(result.similarity * 100).toFixed(1)}% (${String(result.differentPixels)} of ${String(result.foregroundPixels)} foreground pixels differ)`,
      notes: result.note === null ? [] : [result.note],
      regions: regionDiagnostics(fitToSize(screenshot, card.width, card.height).image, card),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { value: null, similarity: null, detail: `could not compare images: ${message}`, notes: [], regions: null };
  }
}
