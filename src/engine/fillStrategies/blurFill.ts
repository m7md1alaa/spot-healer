import type { FillStrategy } from './types';

/** How many points around the brush are sampled to estimate local skin tone. */
const RING_SAMPLES = 16;

/** Sample ring sits this many brush-radii out from the center. */
const RING_DISTANCE_FACTOR = 1.6;

/**
 * Blur/average fill — the default "healing" strategy.
 *
 * Samples a ring of pixels around the brush from the *original* image,
 * averages them into a single local skin-tone color, then blends every
 * pixel inside the brush toward that color. Falloff is linear, starting
 * at `radius * hardness` and reaching 0 at the brush edge.
 *
 * Cheap (one average per stamp) and predictable on uniform skin areas,
 * which is the common case for small blemishes.
 */
export const blurFill: FillStrategy = (ctx, stamp) => {
  const { original, working, width, height } = ctx;
  const { x: cx, y: cy, radius, hardness } = stamp;

  const ringRadius = radius * RING_DISTANCE_FACTOR;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < RING_SAMPLES; i++) {
    const angle = (i / RING_SAMPLES) * Math.PI * 2;
    const sx = Math.round(cx + Math.cos(angle) * ringRadius);
    const sy = Math.round(cy + Math.sin(angle) * ringRadius);
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;

    const idx = (sy * width + sx) * 4;
    r += original.data[idx];
    g += original.data[idx + 1];
    b += original.data[idx + 2];
    count++;
  }

  // Brush is entirely off-canvas — nothing to sample, nothing to do.
  if (count === 0) return;

  r /= count;
  g /= count;
  b /= count;

  const featherStart = radius * hardness;
  const featherRange = radius - featherStart || 1;

  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;

      const alpha = dist <= featherStart ? 1 : 1 - (dist - featherStart) / featherRange;

      const idx = (y * width + x) * 4;
      working.data[idx] += (r - working.data[idx]) * alpha;
      working.data[idx + 1] += (g - working.data[idx + 1]) * alpha;
      working.data[idx + 2] += (b - working.data[idx + 2]) * alpha;
      // Alpha channel (idx + 3) left untouched — source images are opaque.
    }
  }
};
