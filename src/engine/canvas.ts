/** Large uploads are downscaled to this max dimension before editing. */
export const MAX_DIMENSION = 1600;

export interface CanvasState {
  width: number;
  height: number;
  /** Pristine pixels — sampling source for fill strategies, never mutated. */
  original: ImageData;
  /** Live, editable pixel buffer shown in the top canvas. */
  working: ImageData;
  originalCanvas: HTMLCanvasElement;
  workingCanvas: HTMLCanvasElement;
  workingCtx: CanvasRenderingContext2D;
}

let state: CanvasState | null = null;

export function getState(): CanvasState | null {
  return state;
}

/**
 * Loads an image into both canvas layers, downscaling if needed.
 * Resets `state` entirely — call once per uploaded photo.
 */
export function loadImage(
  image: HTMLImageElement,
  originalCanvas: HTMLCanvasElement,
  workingCanvas: HTMLCanvasElement
): CanvasState {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  originalCanvas.width = width;
  originalCanvas.height = height;
  workingCanvas.width = width;
  workingCanvas.height = height;

  const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
  const workingCtx = workingCanvas.getContext('2d', { willReadFrequently: true });
  if (!originalCtx || !workingCtx) {
    throw new Error('Canvas 2D context is not available');
  }

  originalCtx.drawImage(image, 0, 0, width, height);
  workingCtx.drawImage(image, 0, 0, width, height);

  const original = originalCtx.getImageData(0, 0, width, height);
  const working = workingCtx.getImageData(0, 0, width, height);

  state = { width, height, original, working, originalCanvas, workingCanvas, workingCtx };
  return state;
}

/** Pushes the in-memory `working` pixels back onto the visible canvas. */
export function commitWorking(): void {
  if (!state) return;
  state.workingCtx.putImageData(state.working, 0, 0);
}

/** Returns a deep copy of the current working pixels, for history snapshots. */
export function cloneWorkingData(): ImageData {
  if (!state) throw new Error('No image loaded');
  return new ImageData(new Uint8ClampedArray(state.working.data), state.width, state.height);
}

/** Replaces the working pixels with a previous snapshot and repaints. */
export function restoreWorkingData(data: ImageData): void {
  if (!state) return;
  state.working = new ImageData(new Uint8ClampedArray(data.data), state.width, state.height);
  commitWorking();
}
