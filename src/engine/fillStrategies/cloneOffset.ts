import type { FillStrategy } from './types';

/**
 * Fixed sample offset, in pixels. The patch this far from the brush center
 * (in the *original* image) is cloned onto the brushed area.
 */
const OFFSET_X = -60;
const OFFSET_Y = -60;

/**
 * Clone/offset fill — classic "healing brush" feel.
 *
 * For each pixel inside the brush, copies the corresponding pixel from a
 * fixed offset position in the *original* image, blended in with the same
 * linear feather falloff as `blurFill`.
 *
 * Not wired into the UI by default — swap it in via
 * `brush.setFillStrategy(cloneOffsetFill)` if a clone-stamp feel is wanted.
 * Note the fixed offset can occasionally sample across an edge (eyebrow,
 * hairline, etc.); a future version could let the user pick the sample
 * point instead of using a fixed offset.
 */
export const cloneOffsetFill: FillStrategy = (ctx, stamp) => {
  const { original, working, width, height } = ctx;
  const { x: cx, y: cy, radius, hardness } = stamp;

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

      const sx = Math.min(width - 1, Math.max(0, x + OFFSET_X));
      const sy = Math.min(height - 1, Math.max(0, y + OFFSET_Y));
      const srcIdx = (sy * width + sx) * 4;

      const alpha = dist <= featherStart ? 1 : 1 - (dist - featherStart) / featherRange;

      const idx = (y * width + x) * 4;
      working.data[idx] += (original.data[srcIdx] - working.data[idx]) * alpha;
      working.data[idx + 1] += (original.data[srcIdx + 1] - working.data[idx + 1]) * alpha;
      working.data[idx + 2] += (original.data[srcIdx + 2] - working.data[idx + 2]) * alpha;
    }
  }
};
