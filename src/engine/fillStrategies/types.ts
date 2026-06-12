/**
 * A fill strategy reads from `original` (pristine, untouched pixels) and
 * writes into `working` (the canvas the user sees and edits).
 *
 * Keeping this interface stable means the brush engine never needs to know
 * which algorithm is active — swapping blurFill for cloneOffsetFill (or
 * adding a new strategy) is a one-line change in `ui/controls.ts`.
 */
export interface FillContext {
  /** Untouched source pixels — always sample from this, never `working`. */
  original: ImageData;
  /** The live, editable pixel buffer. Mutate this in place. */
  working: ImageData;
  width: number;
  height: number;
}

export interface BrushStamp {
  /** Center of the stamp, in image pixel coordinates. */
  x: number;
  y: number;
  /** Radius of the stamp, in image pixels. */
  radius: number;
  /** 0 = fully soft/feathered edge, 1 = hard edge. */
  hardness: number;
}

export type FillStrategy = (ctx: FillContext, stamp: BrushStamp) => void;
