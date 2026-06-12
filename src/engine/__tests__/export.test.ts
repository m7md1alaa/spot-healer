import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSaveAs = vi.fn();
vi.mock('file-saver', () => ({
  saveAs: mockSaveAs,
}));

const mockGetState = vi.fn();
vi.mock('../canvas', () => ({
  getState: mockGetState,
}));

describe('downloadImage', () => {
  beforeEach(() => {
    mockSaveAs.mockClear();
    mockGetState.mockClear();
  });

  it('calls saveAs with blob when state exists', async () => {
    const { downloadImage } = await import('../export');

    const toBlob = vi.fn((cb: (blob: Blob | null) => void) => {
      cb(new Blob(['test'], { type: 'image/png' }));
    });
    mockGetState.mockReturnValue({
      workingCanvas: { toBlob },
    });

    downloadImage();

    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    expect(mockSaveAs).toHaveBeenCalledWith(expect.any(Blob), 'retouched-photo.png');
  });

  it('uses custom filename when provided', async () => {
    const { downloadImage } = await import('../export');

    const toBlob = vi.fn((cb: (blob: Blob | null) => void) => {
      cb(new Blob(['test'], { type: 'image/png' }));
    });
    mockGetState.mockReturnValue({
      workingCanvas: { toBlob },
    });

    downloadImage('custom.png');

    expect(mockSaveAs).toHaveBeenCalledWith(expect.any(Blob), 'custom.png');
  });

  it('does nothing when state is null', async () => {
    const { downloadImage } = await import('../export');

    mockGetState.mockReturnValue(null);
    downloadImage();

    expect(mockSaveAs).not.toHaveBeenCalled();
  });

  it('does nothing when toBlob returns null', async () => {
    const { downloadImage } = await import('../export');

    const toBlob = vi.fn((cb: (blob: Blob | null) => void) => {
      cb(null);
    });
    mockGetState.mockReturnValue({
      workingCanvas: { toBlob },
    });

    downloadImage();

    expect(mockSaveAs).not.toHaveBeenCalled();
  });
});
