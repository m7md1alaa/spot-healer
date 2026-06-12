import type { FillStrategy } from "./types";

/**
 * Successive Over-Relaxation (SOR) iterations.
 * 50 iterations with SOR is enough for most standard brush sizes
 * to completely clear the center smudge.
 */
const ITERATIONS = 50;

/** * Relaxation factor for SOR (usually between 1.0 and 2.0).
 * 1.7 provides a highly aggressive wave propagation inward.
 */
const OMEGA = 1.7;

/** Samples `imgData` at (x, y), clamped to canvas bounds. */
function samplePixel(
  imgData: ImageData,
  width: number,
  height: number,
  x: number,
  y: number,
  c: number,
): number {
  const sx = Math.min(width - 1, Math.max(0, x));
  const sy = Math.min(height - 1, Math.max(0, y));
  return imgData.data[(sy * width + sx) * 4 + c];
}

/**
 * Calculates the difference (SSD) between the border of the target patch
 * and the border of a potential source patch.
 * A lower score means a better match (avoiding hair, edges, etc.).
 */
function evaluatePatchMatch(
  imgData: ImageData,
  width: number,
  height: number,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  radius: number,
): number {
  let ssd = 0;
  let samples = 0;

  // Check 16 points around the border "ring"
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const checkRadius = radius * 1.1; // Look just outside the brush radius

    const tx = Math.round(cx + Math.cos(angle) * checkRadius);
    const ty = Math.round(cy + Math.sin(angle) * checkRadius);

    const testSx = Math.round(sx + Math.cos(angle) * checkRadius);
    const testSy = Math.round(sy + Math.sin(angle) * checkRadius);

    // If the potential source goes off the canvas, penalize it heavily
    if (testSx < 0 || testSx >= width || testSy < 0 || testSy >= height) {
      return Infinity;
    }

    for (let c = 0; c < 3; c++) {
      // Use the CURRENT state of the image (imgData) so we don't match against old blemishes
      const targetColor = samplePixel(imgData, width, height, tx, ty, c);
      const sourceColor = samplePixel(
        imgData,
        width,
        height,
        testSx,
        testSy,
        c,
      );
      const diff = targetColor - sourceColor;
      ssd += diff * diff;
    }
    samples++;
  }

  return ssd / samples;
}

/**
 * Scans around the blemish to find the best clean skin patch.
 */
function findSmartOffset(
  imgData: ImageData,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
): { sx: number; sy: number } {
  let bestScore = Infinity;
  let bestSx = cx;
  let bestSy = cy;

  const searchDistances = [radius * 2.0, radius * 3.0];

  for (const dist of searchDistances) {
    // Search 12 directions (like a clock face)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const sx = Math.round(cx + Math.cos(angle) * dist);
      const sy = Math.round(cy + Math.sin(angle) * dist);

      const score = evaluatePatchMatch(
        imgData,
        width,
        height,
        cx,
        cy,
        sx,
        sy,
        radius,
      );

      if (score < bestScore) {
        bestScore = score;
        bestSx = sx;
        bestSy = sy;
      }
    }
  }

  // Fallback to a standard offset if stuck
  if (bestScore === Infinity) {
    return { sx: cx - radius * 2.2, sy: cy - radius * 2.2 };
  }

  return { sx: bestSx, sy: bestSy };
}

/**
 * Seamless clone fill — Smart offset matching + in-place SOR Laplace solver.
 */
export const poissonFill: FillStrategy = (ctx, stamp) => {
  // We extract working to represent the current visible state
  const { working, width, height } = ctx;
  const { x: cx, y: cy, radius, hardness } = stamp;

  // 1. Find the safest texture patch using the CURRENT image state
  const smartOffset = findSmartOffset(working, width, height, cx, cy, radius);

  const minX = Math.max(0, Math.floor(cx - radius) - 1);
  const maxX = Math.min(width - 1, Math.ceil(cx + radius) + 1);
  const minY = Math.max(0, Math.floor(cy - radius) - 1);
  const maxY = Math.min(height - 1, Math.ceil(cy + radius) + 1);

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const count = boxW * boxH;

  const featherStart = radius * hardness;
  const featherRange = radius - featherStart || 1;

  const alpha = new Float32Array(count);
  const source = new Float32Array(count * 3);
  const diff = new Float32Array(count * 3);

  const interior: number[] = [];

  // 2. Setup the boundary conditions and source textures
  for (let by = 0; by < boxH; by++) {
    for (let bx = 0; bx < boxW; bx++) {
      const i = by * boxW + bx;
      const x = minX + bx;
      const y = minY + by;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Map the current pixel to the smart offset patch
      const sx = Math.round(smartOffset.sx + dx);
      const sy = Math.round(smartOffset.sy + dy);
      const workIdx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        // Read the texture from the CURRENT working canvas so we don't resurrect old blemishes
        const srcVal = samplePixel(working, width, height, sx, sy, c);
        source[i * 3 + c] = srcVal;
        diff[i * 3 + c] = working.data[workIdx + c] - srcVal;
      }

      if (dist <= radius) {
        alpha[i] =
          dist <= featherStart ? 1 : 1 - (dist - featherStart) / featherRange;
        interior.push(i);

        diff[i * 3] = 0;
        diff[i * 3 + 1] = 0;
        diff[i * 3 + 2] = 0;
      }
    }
  }

  // 3. SOR / Gauss-Seidel Solver for lightning-fast diffusion
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const i of interior) {
      const bx = i % boxW;
      const by = Math.floor(i / boxW);

      const bxLeft = bx > 0 ? bx - 1 : 0;
      const bxRight = bx < boxW - 1 ? bx + 1 : boxW - 1;
      const byUp = by > 0 ? by - 1 : 0;
      const byDown = by < boxH - 1 ? by + 1 : boxH - 1;

      const idxLeft = (by * boxW + bxLeft) * 3;
      const idxRight = (by * boxW + bxRight) * 3;
      const idxUp = (byUp * boxW + bx) * 3;
      const idxDown = (byDown * boxW + bx) * 3;
      const idxCenter = i * 3;

      for (let c = 0; c < 3; c++) {
        const currentVal = diff[idxCenter + c];

        const targetVal =
          (diff[idxLeft + c] +
            diff[idxRight + c] +
            diff[idxUp + c] +
            diff[idxDown + c]) *
          0.25;

        diff[idxCenter + c] = currentVal + OMEGA * (targetVal - currentVal);
      }
    }
  }

  // 4. Apply final healed image back to canvas
  for (const i of interior) {
    const bx = i % boxW;
    const by = Math.floor(i / boxW);
    const x = minX + bx;
    const y = minY + by;
    const workIdx = (y * width + x) * 4;
    const a = alpha[i];

    for (let c = 0; c < 3; c++) {
      const healed = source[i * 3 + c] + diff[i * 3 + c];
      working.data[workIdx + c] += (healed - working.data[workIdx + c]) * a;
    }
  }
};
