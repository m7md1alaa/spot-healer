import type { FillStrategy } from './types';

/** How many points are sampled to estimate average tone of a patch. */
const RING_SAMPLES = 16;

/** Sample ring sits this many brush-radii out from its center. */
const RING_DISTANCE_FACTOR = 1.6;

/** Source patch is offset this many brush-radii away (up and to the left). */
const SOURCE_OFFSET_FACTOR = 2.2;

/** Averages a ring of `original` pixels around (cx, cy). Returns null if fully off-canvas. */
function sampleRingTone(
  original: ImageData,
  width: number,
  height: number,
  cx: number,
  cy: number,
  ringRadius: number
): [number, number, number] | null {
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

  if (count === 0) return null;
  return [r / count, g / count, b / count];
}

/**
 * Texture-preserving fill — the default "healing" strategy.
 *
 * Clones a clean patch of skin from an offset position, but recolors it so
 * its average tone matches the skin immediately around the blemish. This
 * removes the blemish's color while keeping real texture (pores, subtle
 * shading) instead of leaving a flat, smudged patch.
 *
 * Falls back to a plain recolored clone if the source patch happens to be
 * off-canvas (rare, only near image edges with a large brush).
 */
export const textureFill: FillStrategy = (ctx, stamp) => {
  const { original, working, width, height } = ctx;
  const { x: cx, y: cy, radius, hardness } = stamp;

  const ringRadius = radius * RING_DISTANCE_FACTOR;
  const offset = radius * SOURCE_OFFSET_FACTOR;
  const srcCx = cx - offset;
  const srcCy = cy - offset;

  const targetTone = sampleRingTone(original, width, height, cx, cy, ringRadius);
  const sourceTone = sampleRingTone(original, width, height, srcCx, srcCy, ringRadius);
  if (!targetTone) return; // brush itself is fully off-canvas

  // [shiftR, shiftG, shiftB] recolors the source patch to match local tone.
  const shift: [number, number, number] = sourceTone
    ? [targetTone[0] - sourceTone[0], targetTone[1] - sourceTone[1], targetTone[2] - sourceTone[2]]
    : [0, 0, 0];

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

      const sx = Math.min(width - 1, Math.max(0, Math.round(x - offset)));
      const sy = Math.min(height - 1, Math.max(0, Math.round(y - offset)));
      const srcIdx = (sy * width + sx) * 4;

      const recoloredR = original.data[srcIdx] + shift[0];
      const recoloredG = original.data[srcIdx + 1] + shift[1];
      const recoloredB = original.data[srcIdx + 2] + shift[2];

      const alpha = dist <= featherStart ? 1 : 1 - (dist - featherStart) / featherRange;

      const idx = (y * width + x) * 4;
      working.data[idx] += (recoloredR - working.data[idx]) * alpha;
      working.data[idx + 1] += (recoloredG - working.data[idx + 1]) * alpha;
      working.data[idx + 2] += (recoloredB - working.data[idx + 2]) * alpha;
    }
  }
};
