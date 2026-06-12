import { describe, it, expect } from 'vitest';
import { cloneOffsetFill } from '../fillStrategies/cloneOffset';
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

describe('cloneOffsetFill', () => {
  it('copies pixel values from offset (-60, -60) in original image', () => {
    // Canvas large enough: 200x200
    // Original has a red pixel at (50, 50) and white at (110, 110) [which = 50+60, 50+60]
    const size = 200;
    const original = createImageData(size, size, (x, y) => {
      if (x === 110 && y === 110) return [255, 0, 0, 255]; // This is +60,+60 from (50,50)
      return [100, 100, 100, 255];
    });
    // Working is all black
    const working = createImageData(size, size, () => [0, 0, 0, 255]);

    // Stamp at (50, 50) - should sample from (50-60, 50-60) = (-10, -10) which clamps to (0,0)
    // Actually with OFFSET_X = -60, OFFSET_Y = -60:
    // For pixel at stamp center (50, 50), source is (min(199, max(0, 50-60)), min(199, max(0, 50-60))) = (0, 0)
    // That pixel in original is [100, 100, 100, 255]
    cloneOffsetFill(makeContext(original, working), makeStamp(50, 50, 3, 1));

    // Center pixel should be blended toward [100, 100, 100] (from clamped offset)
    const p = pixelAt(working, 50, 50);
    expect(p.r).toBe(100);
    expect(p.g).toBe(100);
    expect(p.b).toBe(100);
  });

  it('does not modify pixels outside brush radius', () => {
    const size = 20;
    const original = createImageData(size, size, () => [100, 100, 100, 255]);
    const working = createImageData(size, size, () => [0, 0, 0, 255]);

    cloneOffsetFill(makeContext(original, working), makeStamp(10, 10, 3, 0.5));

    const far = pixelAt(working, 0, 0);
    expect(far.r).toBe(0);
    expect(far.g).toBe(0);
    expect(far.b).toBe(0);
  });

  it('clamps source coordinates at canvas edges', () => {
    // Stamp at (2, 2) with offset -60: source would be (-58, -58), clamped to (0, 0)
    const size = 50;
    const original = createImageData(size, size, () => [255, 100, 50, 255]);
    const working = createImageData(size, size, () => [0, 0, 0, 255]);

    cloneOffsetFill(makeContext(original, working), makeStamp(2, 2, 1, 1));

    const p = pixelAt(working, 2, 2);
    expect(p.r).toBe(255);
    expect(p.g).toBe(100);
    expect(p.b).toBe(50);
  });

  it('works at canvas edges without throwing', () => {
    const size = 10;
    const original = createImageData(size, size, () => [128, 128, 128, 255]);
    const working = createImageData(size, size, () => [0, 0, 0, 255]);

    expect(() => {
      cloneOffsetFill(makeContext(original, working), makeStamp(0, 0, 5, 0.5));
    }).not.toThrow();
  });

  it('large brush on small canvas does not throw', () => {
    const size = 5;
    const original = createImageData(size, size, () => [128, 128, 128, 255]);
    const working = createImageData(size, size, () => [0, 0, 0, 255]);

    expect(() => {
      cloneOffsetFill(makeContext(original, working), makeStamp(2, 2, 20, 0.5));
    }).not.toThrow();
  });
});
