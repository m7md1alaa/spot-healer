import { describe, it, expect } from 'vitest';
import { blurFill } from '../fillStrategies/blurFill';
import type { FillContext, BrushStamp } from '../fillStrategies/types';

function createImageData(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number, number] = () => [0, 0, 0, 255],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y);
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return new ImageData(data, width, height);
}

function makeContext(original: ImageData, working: ImageData): FillContext {
  return {
    original,
    working,
    width: original.width,
    height: original.height,
  };
}

function makeStamp(
  x: number,
  y: number,
  radius: number,
  hardness: number = 0.5,
): BrushStamp {
  return { x, y, radius, hardness };
}

function pixelAt(data: ImageData, x: number, y: number) {
  const idx = (y * data.width + x) * 4;
  return {
    r: data.data[idx],
    g: data.data[idx + 1],
    b: data.data[idx + 2],
    a: data.data[idx + 3],
  };
}

describe('blurFill', () => {
  it('modifies pixels within brush radius on working data', () => {
    // Original is uniform white — the ring samples will all be white,
    // so the average is white and pixels get blended toward white.
    const size = 20;
    const original = createImageData(size, size, () => [200, 200, 200, 255]);
    const working = createImageData(size, size, () => [0, 0, 0, 255]);

    blurFill(makeContext(original, working), makeStamp(10, 10, 5, 0.5));

    // Pixels near center should be modified (not black anymore)
    const center = pixelAt(working, 10, 10);
    const modified = center.r > 0 || center.g > 0 || center.b > 0;
    expect(modified).toBe(true);
  });

  it('does not modify pixels outside brush radius', () => {
    const size = 20;
    const original = createImageData(size, size, () => [100, 100, 100, 255]);
    const working = createImageData(size, size, () => [0, 0, 0, 255]);

    blurFill(makeContext(original, working), makeStamp(10, 10, 3, 0.5));

    // Pixel far from center should remain unchanged
    const far = pixelAt(working, 0, 0);
    expect(far.r).toBe(0);
    expect(far.g).toBe(0);
    expect(far.b).toBe(0);
  });

  it('does nothing when brush is entirely off-canvas', () => {
    const size = 10;
    const working = createImageData(size, size, () => [100, 100, 100, 255]);

    blurFill(makeContext(createImageData(size, size), working), makeStamp(50, 50, 3, 0.5));

    // All pixels should remain unchanged
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = pixelAt(working, x, y);
        expect(p.r).toBe(100);
        expect(p.g).toBe(100);
        expect(p.b).toBe(100);
      }
    }
  });

  it('samples from original image, not working data', () => {
    const size = 20;
    // Original is all white
    const original = createImageData(size, size, () => [200, 200, 200, 255]);
    // Working is all black
    const working = createImageData(size, size, () => [0, 0, 0, 255]);

    blurFill(makeContext(original, working), makeStamp(10, 10, 2, 1));

    // Pixels should be blended toward white (from original), not stay black
    const p = pixelAt(working, 10, 10);
    expect(p.r).toBeGreaterThan(0);
  });

  it('leaves alpha channel untouched', () => {
    const size = 10;
    const original = createImageData(size, size, () => [100, 100, 100, 255]);
    const working = createImageData(size, size, () => [0, 0, 0, 128]);

    blurFill(makeContext(original, working), makeStamp(5, 5, 3, 0.5));

    // Alpha should still be 128
    const p = pixelAt(working, 5, 5);
    expect(p.a).toBe(128);
  });

  it('with hardness=1 applies full blend at featherStart', () => {
    const size = 10;
    const original = createImageData(size, size, () => [255, 0, 0, 255]);
    const working = createImageData(size, size, () => [0, 0, 0, 255]);

    blurFill(makeContext(original, working), makeStamp(5, 5, 4, 1));

    // Center pixel should be fully red (full blend)
    const p = pixelAt(working, 5, 5);
    expect(p.r).toBe(255);
    expect(p.g).toBe(0);
    expect(p.b).toBe(0);
  });

  it('works at canvas edges without throwing', () => {
    // Brush partially at top-left corner
    const size = 10;
    const original = createImageData(size, size, () => [128, 128, 128, 255]);
    const working = createImageData(size, size, () => [0, 0, 0, 255]);

    expect(() => {
      blurFill(makeContext(original, working), makeStamp(0, 0, 5, 0.5));
    }).not.toThrow();
  });

  it('large brush on small canvas does not throw', () => {
    const size = 5;
    const original = createImageData(size, size, () => [128, 128, 128, 255]);
    const working = createImageData(size, size, () => [0, 0, 0, 255]);

    expect(() => {
      blurFill(makeContext(original, working), makeStamp(2, 2, 20, 0.5));
    }).not.toThrow();
  });
});
