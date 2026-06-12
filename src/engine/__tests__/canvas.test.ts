import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockCanvas() {
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
  };

  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn((_: string, _opts?: object) => ctx),
  } as unknown as HTMLCanvasElement;

  return { canvas, ctx };
}

describe('canvas', () => {
  let originalCanvas: HTMLCanvasElement;
  let workingCanvas: HTMLCanvasElement;
  let originalCtx: ReturnType<typeof createMockCanvas>['ctx'];
  let workingCtx: ReturnType<typeof createMockCanvas>['ctx'];

  beforeEach(() => {
    const m1 = createMockCanvas();
    const m2 = createMockCanvas();
    originalCanvas = m1.canvas;
    workingCanvas = m2.canvas;
    originalCtx = m1.ctx;
    workingCtx = m2.ctx;
  });

  describe('MAX_DIMENSION', () => {
    it('is 1600', async () => {
      const { MAX_DIMENSION } = await import('../canvas');
      expect(MAX_DIMENSION).toBe(1600);
    });
  });

  describe('loadImage', () => {
    it('throws when getContext returns null', async () => {
      const { loadImage } = await import('../canvas');
      const canvas = { getContext: vi.fn(() => null) } as unknown as HTMLCanvasElement;
      const img = { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;

      expect(() => loadImage(img, canvas, canvas)).toThrow('Canvas 2D context is not available');
    });

    it('sets canvas dimensions from image natural size', async () => {
      const { loadImage } = await import('../canvas');

      originalCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(100 * 100 * 4),
        width: 100,
        height: 100,
      });
      workingCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(100 * 100 * 4),
        width: 100,
        height: 100,
      });

      const img = { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;
      loadImage(img, originalCanvas, workingCanvas);

      expect(originalCanvas.width).toBe(100);
      expect(originalCanvas.height).toBe(100);
      expect(workingCanvas.width).toBe(100);
      expect(workingCanvas.height).toBe(100);
    });

    it('downscales when image exceeds MAX_DIMENSION', async () => {
      const { loadImage, MAX_DIMENSION } = await import('../canvas');

      const dim = MAX_DIMENSION;
      originalCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(dim * dim * 4),
        width: dim,
        height: dim,
      });
      workingCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(dim * dim * 4),
        width: dim,
        height: dim,
      });

      const img = { naturalWidth: 3200, naturalHeight: 2400 } as HTMLImageElement;
      loadImage(img, originalCanvas, workingCanvas);

      expect(workingCanvas.width).toBe(dim);
      expect(workingCanvas.height).toBe(Math.round(2400 * (dim / 3200)));
    });

    it('draws image on both canvases', async () => {
      const { loadImage } = await import('../canvas');

      originalCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(100 * 100 * 4),
        width: 100,
        height: 100,
      });
      workingCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(100 * 100 * 4),
        width: 100,
        height: 100,
      });

      const img = { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;
      loadImage(img, originalCanvas, workingCanvas);

      expect(originalCtx.drawImage).toHaveBeenCalledWith(img, 0, 0, 100, 100);
      expect(workingCtx.drawImage).toHaveBeenCalledWith(img, 0, 0, 100, 100);
    });

    it('returns CanvasState with correct properties', async () => {
      const { loadImage } = await import('../canvas');

      originalCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(50 * 50 * 4),
        width: 50,
        height: 50,
      });
      workingCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(50 * 50 * 4),
        width: 50,
        height: 50,
      });

      const img = { naturalWidth: 50, naturalHeight: 50 } as HTMLImageElement;
      const state = loadImage(img, originalCanvas, workingCanvas);

      expect(state.width).toBe(50);
      expect(state.height).toBe(50);
      expect(state.originalCanvas).toBe(originalCanvas);
      expect(state.workingCanvas).toBe(workingCanvas);
      expect(state.workingCtx).toBe(workingCtx);
    });

    it('stores original pixels separate from working pixels', async () => {
      const { loadImage } = await import('../canvas');

      const origData = new Uint8ClampedArray(10 * 10 * 4);
      origData.fill(100);
      const workData = new Uint8ClampedArray(10 * 10 * 4);
      workData.fill(200);

      originalCtx.getImageData.mockReturnValue({
        data: origData, width: 10, height: 10,
      } as unknown as ImageData);
      workingCtx.getImageData.mockReturnValue({
        data: workData, width: 10, height: 10,
      } as unknown as ImageData);

      const img = { naturalWidth: 10, naturalHeight: 10 } as HTMLImageElement;
      const state = loadImage(img, originalCanvas, workingCanvas);

      // Original should have the 100-filled data
      expect(state.original.data[0]).toBe(100);
      // Working should have the 200-filled data
      expect(state.working.data[0]).toBe(200);
    });
  });

  describe('commitWorking', () => {
    it('does not throw when state is null', async () => {
      const { commitWorking } = await import('../canvas');
      expect(() => commitWorking()).not.toThrow();
    });

    it('writes working pixels to canvas context', async () => {
      const { loadImage, commitWorking } = await import('../canvas');

      originalCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(10 * 10 * 4),
        width: 10,
        height: 10,
      });
      workingCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(10 * 10 * 4),
        width: 10,
        height: 10,
      });

      const img = { naturalWidth: 10, naturalHeight: 10 } as HTMLImageElement;
      const state = loadImage(img, originalCanvas, workingCanvas);

      commitWorking();

      expect(workingCtx.putImageData).toHaveBeenCalledWith(state.working, 0, 0);
    });
  });

  describe('cloneWorkingData', () => {
    it('returns a deep copy of working pixels', async () => {
      const { loadImage, cloneWorkingData } = await import('../canvas');

      const data = new Uint8ClampedArray(10 * 10 * 4);
      data[0] = 42;
      originalCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(data), width: 10, height: 10,
      } as unknown as ImageData);
      workingCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(data), width: 10, height: 10,
      } as unknown as ImageData);

      const img = { naturalWidth: 10, naturalHeight: 10 } as HTMLImageElement;
      loadImage(img, originalCanvas, workingCanvas);

      const copy = cloneWorkingData();
      expect(copy.data[0]).toBe(42);
      expect(copy.width).toBe(10);
      expect(copy.height).toBe(10);

      // Modifying the copy should not affect original
      copy.data[0] = 99;
      const { getState } = await import('../canvas');
      expect(getState()!.working.data[0]).toBe(42);
    });
  });

  describe('restoreWorkingData', () => {
    it('replaces working pixels with given data and repaints', async () => {
      const { loadImage, restoreWorkingData, getState } = await import('../canvas');

      originalCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(10 * 10 * 4),
        width: 10,
        height: 10,
      });
      workingCtx.getImageData.mockReturnValue({
        data: new Uint8ClampedArray(10 * 10 * 4),
        width: 10,
        height: 10,
      });

      const img = { naturalWidth: 10, naturalHeight: 10 } as HTMLImageElement;
      loadImage(img, originalCanvas, workingCanvas);

      const newData = new Uint8ClampedArray(10 * 10 * 4);
      newData[0] = 77;
      const restored = new ImageData(newData, 10, 10);
      restoreWorkingData(restored);

      expect(workingCtx.putImageData).toHaveBeenCalled();
      const state = getState()!;
      expect(state.working.data[0]).toBe(77);
    });

    it('does not throw when state is null', async () => {
      const { restoreWorkingData } = await import('../canvas');
      const data = new ImageData(new Uint8ClampedArray(4), 1, 1);
      expect(() => restoreWorkingData(data)).not.toThrow();
    });
  });
});
