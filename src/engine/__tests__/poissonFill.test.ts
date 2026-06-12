import { describe, it, expect, beforeEach } from "vitest";
import { poissonFill } from "../fillStrategies/poissonFill";

// --- Mock Types & Helpers ---
// Mocking ImageData so tests run fast in Node without needing a full DOM/Canvas environment
class MockImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  colorSpace: PredefinedColorSpace = "srgb";

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

// Helper to easily set a pixel color in our mock
function setPixel(
  img: MockImageData,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
) {
  if (x < 0 || x >= img.width || y < 0 || y >= img.height) return;
  const idx = (y * img.width + x) * 4;
  img.data[idx] = r;
  img.data[idx + 1] = g;
  img.data[idx + 2] = b;
  img.data[idx + 3] = a;
}

// Helper to get a pixel's RGB
function getPixel(img: MockImageData, x: number, y: number) {
  const idx = (y * img.width + x) * 4;
  return {
    r: img.data[idx],
    g: img.data[idx + 1],
    b: img.data[idx + 2],
  };
}

describe("poissonFill Algorithm", () => {
  let original: MockImageData;
  let working: MockImageData;
  const WIDTH = 100;
  const HEIGHT = 100;

  beforeEach(() => {
    // Reset canvas to a flat "skin tone" (e.g., RGB 200, 180, 150) before every test
    original = new MockImageData(WIDTH, HEIGHT);
    working = new MockImageData(WIDTH, HEIGHT);

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        setPixel(original, x, y, 200, 180, 150);
        setPixel(working, x, y, 200, 180, 150);
      }
    }
  });

  it("modifies pixels inside the brush radius to remove a blemish", () => {
    // 1. Create a "pimple" (dark red dot) in the center of the working canvas
    const cx = 50;
    const cy = 50;
    setPixel(working, cx, cy, 100, 0, 0);
    setPixel(working, cx + 1, cy, 100, 0, 0);

    const ctx = {
      original: original as unknown as ImageData,
      working: working as unknown as ImageData,
      width: WIDTH,
      height: HEIGHT,
    };
    const stamp = { x: cx, y: cy, radius: 5, hardness: 0.5 };

    // 2. Run the fill
    poissonFill(ctx, stamp);

    // 3. The center pixel should no longer be dark red. It should be healed back near the skin tone (200)
    const healedPixel = getPixel(working, cx, cy);
    expect(healedPixel.r).toBeGreaterThan(150); // It has been blended away from 100
  });

  it("strictly ignores pixels completely outside the brush radius", () => {
    const cx = 50;
    const cy = 50;
    const radius = 5;

    // Place a tracking pixel outside the radius
    const outsideX = 60;
    const outsideY = 60;
    setPixel(working, outsideX, outsideY, 99, 99, 99);

    const ctx = {
      original: original as unknown as ImageData,
      working: working as unknown as ImageData,
      width: WIDTH,
      height: HEIGHT,
    };
    const stamp = { x: cx, y: cy, radius, hardness: 0.5 };

    poissonFill(ctx, stamp);

    // The pixel at (60, 60) should be completely untouched
    const trackedPixel = getPixel(working, outsideX, outsideY);
    expect(trackedPixel.r).toBe(99);
    expect(trackedPixel.g).toBe(99);
    expect(trackedPixel.b).toBe(99);
  });

  it("safely handles canvas boundaries without crashing (out of bounds)", () => {
    const ctx = {
      original: original as unknown as ImageData,
      working: working as unknown as ImageData,
      width: WIDTH,
      height: HEIGHT,
    };

    // Stamp exactly at top-left
    expect(() =>
      poissonFill(ctx, { x: 0, y: 0, radius: 10, hardness: 0.8 }),
    ).not.toThrow();

    // Stamp exactly at bottom-right
    expect(() =>
      poissonFill(ctx, { x: WIDTH, y: HEIGHT, radius: 10, hardness: 0.8 }),
    ).not.toThrow();

    // Stamp halfway off the canvas
    expect(() =>
      poissonFill(ctx, { x: -5, y: -5, radius: 10, hardness: 0.8 }),
    ).not.toThrow();
  });

  it("smart offset correctly avoids edges/hair and picks smooth texture", () => {
    // 1. Setup a tricky scenario:
    // - Left side is clean skin (RGB 200, 200, 200)
    // - Right side is dark hair (RGB 0, 0, 0) starting at x = 60
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 60; x < WIDTH; x++) {
        setPixel(working, x, y, 0, 0, 0);
      }
    }

    // 2. User clicks a blemish near the hairline (x=50, y=50)
    // Radius is 5.
    // A blind offset looking right (+10px) would hit the black hair and smear it.
    // The smart offset should realize the hair has a massive SSD error and look left instead.
    const cx = 50;
    const cy = 50;

    // Create the blemish
    setPixel(working, cx, cy, 255, 0, 0);

    const ctx = {
      original: original as unknown as ImageData,
      working: working as unknown as ImageData,
      width: WIDTH,
      height: HEIGHT,
    };
    const stamp = { x: cx, y: cy, radius: 4, hardness: 0.5 };

    poissonFill(ctx, stamp);

    // 3. Verify the result
    // If it blindly copied the hair, the center pixel would drop to near 0.
    // If it smartly copied the skin, it should remain near 200.
    const healedPixel = getPixel(working, cx, cy);

    expect(healedPixel.r).toBeGreaterThan(150); // It copied the bright skin, NOT the dark hair!
    expect(healedPixel.g).toBeGreaterThan(150);
  });
});
