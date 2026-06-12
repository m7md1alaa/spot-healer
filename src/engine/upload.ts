import imageCompression from 'browser-image-compression';
import { loadImage, MAX_DIMENSION } from './canvas';
import { reset as resetHistory } from './history';

export interface UploadResult {
  width: number;
  height: number;
}

/**
 * Loads a user-selected photo into the canvas layers.
 *
 * Runs the file through browser-image-compression first, which both fixes
 * the classic "iPhone photo appears rotated" EXIF-orientation bug and caps
 * the resolution before we ever touch raw pixel data — keeping later
 * ImageData operations fast.
 */
export async function handleFileUpload(
  file: File,
  originalCanvas: HTMLCanvasElement,
  workingCanvas: HTMLCanvasElement
): Promise<UploadResult> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: MAX_DIMENSION,
    useWebWorker: true,
  });

  const image = await loadImageFromBlob(compressed);
  const state = loadImage(image, originalCanvas, workingCanvas);
  resetHistory();

  return { width: state.width, height: state.height };
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}
