import { cloneWorkingData, restoreWorkingData } from './canvas';

/** Capped so memory use stays bounded on large images / long sessions. */
const MAX_HISTORY = 20;

let undoStack: ImageData[] = [];
let redoStack: ImageData[] = [];

/** Call when a new photo is loaded — clears any history from the previous one. */
export function reset(): void {
  undoStack = [];
  redoStack = [];
}

/** Call once, right before a brush stroke starts (on pointerdown). */
export function snapshotBeforeStroke(): void {
  undoStack.push(cloneWorkingData());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

export function undo(): void {
  const previous = undoStack.pop();
  if (!previous) return;
  redoStack.push(cloneWorkingData());
  restoreWorkingData(previous);
}

export function redo(): void {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(cloneWorkingData());
  restoreWorkingData(next);
}
