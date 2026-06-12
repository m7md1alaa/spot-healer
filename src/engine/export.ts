import { saveAs } from 'file-saver';
import { getState } from './canvas';

/**
 * Exports the current edited image as a PNG download.
 * Uses file-saver to smooth over Safari/iOS blob-download quirks.
 */
export function downloadImage(filename = 'retouched-photo.png'): void {
  const state = getState();
  if (!state) return;

  state.workingCanvas.toBlob((blob) => {
    if (blob) saveAs(blob, filename);
  }, 'image/png');
}
