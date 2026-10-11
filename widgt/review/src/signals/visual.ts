import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, sep } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { visualScore } from '../score';

/** An RGBA bitmap, 4 bytes per pixel, row-major. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

const WHITE = [255, 255, 255, 255] as const;

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
}

/**
 * The visual signal: compares the 401px screenshot with the reference,
 * writes `diff.png`, and maps similarity onto 0-100. Missing or unreadable
 * images produce `null` with a reason instead of throwing.
 */
export function collectVisual(
  paths: { readonly screenshot: string; readonly reference: string; readonly diff: string },
  displayRoot: string | null = null,
): VisualSignal {
  const show = (path: string): string => (displayRoot === null ? path : relative(displayRoot, path).split(sep).join('/'));
  if (!existsSync(paths.reference)) {
    return { value: null, similarity: null, detail: `reference not found: ${show(paths.reference)}`, notes: [] };
  }
  if (!existsSync(paths.screenshot)) {
    return { value: null, similarity: null, detail: `screenshot not found: ${show(paths.screenshot)}`, notes: [] };
  }
  try {
    const result = compareImages(readPng(paths.screenshot), readPng(paths.reference));
    writePng(paths.diff, result.diff);
    return {
      value: visualScore(result.similarity),
      similarity: result.similarity,
      detail: `foreground similarity ${(result.similarity * 100).toFixed(1)}% (${String(result.differentPixels)} of ${String(result.foregroundPixels)} foreground pixels differ)`,
      notes: result.note === null ? [] : [result.note],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { value: null, similarity: null, detail: `could not compare images: ${message}`, notes: [] };
  }
}
