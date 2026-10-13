import type { RgbaImage } from '../signals/visual';

/** An opaque RGB colour. */
export type Rgb = readonly [number, number, number];

export const WHITE: Rgb = [255, 255, 255];
export const BLACK: Rgb = [0, 0, 0];

/** A solid image, white unless a colour is given. */
export function blank(width: number, height: number, rgb: Rgb = WHITE): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set([...rgb, 255], i * 4);
  return { width, height, data };
}

/** A copy of `image` with the rectangle filled (clipped to the image). */
export function paint(image: RgbaImage, x: number, y: number, width: number, height: number, rgb: Rgb = BLACK): RgbaImage {
  const data = new Uint8Array(image.data);
  for (let yy = Math.max(0, y); yy < Math.min(image.height, y + height); yy += 1) {
    for (let xx = Math.max(0, x); xx < Math.min(image.width, x + width); xx += 1) {
      data.set([...rgb, 255], (yy * image.width + xx) * 4);
    }
  }
  return { width: image.width, height: image.height, data };
}

/** A copy of `image` whose content has moved by (dx, dy); uncovered pixels are white. */
export function shifted(image: RgbaImage, dx: number, dy: number): RgbaImage {
  const out = blank(image.width, image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sx = x - dx;
      const sy = y - dy;
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
      const source = (sy * image.width + sx) * 4;
      out.data.set(image.data.subarray(source, source + 4), (y * image.width + x) * 4);
    }
  }
  return out;
}

/** A copy of the rectangle of `image` at (x, y); pixels outside `image` are white. */
export function cropped(image: RgbaImage, x: number, y: number, width: number, height: number): RgbaImage {
  const out = blank(width, height);
  for (let yy = 0; yy < height; yy += 1) {
    for (let xx = 0; xx < width; xx += 1) {
      const sx = x + xx;
      const sy = y + yy;
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
      const source = (sy * image.width + sx) * 4;
      out.data.set(image.data.subarray(source, source + 4), (yy * width + xx) * 4);
    }
  }
  return out;
}

/**
 * Full-width black stripes, two rows thick every four rows, from the top down
 * to row `rows` (default: the whole height). Pure black on white, so
 * pixelmatch finds no anti-aliasing in it.
 */
export function stripes(width: number, height: number, rows = height): RgbaImage {
  let image = blank(width, height);
  for (let y = 0; y < rows; y += 4) image = paint(image, 0, y, width, Math.min(2, rows - y));
  return image;
}

/** The pixel at (x, y) as [r, g, b, a]. */
export function pixel(image: RgbaImage, x: number, y: number): number[] {
  const at = (y * image.width + x) * 4;
  return [...image.data.subarray(at, at + 4)];
}
