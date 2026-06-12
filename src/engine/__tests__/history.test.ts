import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClone = vi.fn();
const mockRestore = vi.fn();

vi.mock('../canvas', () => ({
  cloneWorkingData: mockClone,
  restoreWorkingData: mockRestore,
}));

const MAX_HISTORY = 20;

// Need to re-import after mocking
const { reset, snapshotBeforeStroke, canUndo, canRedo, undo, redo } =
  await import('../history');

function mockImageData(id: number): ImageData {
  return { data: new Uint8ClampedArray([id]), width: 1, height: 1 } as unknown as ImageData;
}

beforeEach(() => {
  reset();
  mockClone.mockClear();
  mockRestore.mockClear();
});

describe('history', () => {
  describe('reset', () => {
    it('clears undo and redo stacks', () => {
      mockClone.mockReturnValue(mockImageData(1));
      snapshotBeforeStroke();

      reset();

      expect(canUndo()).toBe(false);
      expect(canRedo()).toBe(false);
    });
  });

  describe('snapshotBeforeStroke', () => {
    it('clones current working data and pushes to undo stack', () => {
      const data = mockImageData(1);
      mockClone.mockReturnValue(data);

      snapshotBeforeStroke();

      expect(mockClone).toHaveBeenCalledTimes(1);
      expect(canUndo()).toBe(true);
    });

    it('clears redo stack', () => {
      mockClone.mockReturnValue(mockImageData(1));
      snapshotBeforeStroke();
      undo();

      expect(canRedo()).toBe(true);

      mockClone.mockReturnValue(mockImageData(2));
      snapshotBeforeStroke();

      expect(canRedo()).toBe(false);
    });

    it('caps undo stack at MAX_HISTORY entries', () => {
      // We need to ensure cloneWorkingData returns unique values each time
      // so undo/redo operations work with distinct snapshots
      let callCount = 0;
      mockClone.mockImplementation(() => {
        callCount++;
        return mockImageData(callCount);
      });

      // Fill the stack beyond MAX_HISTORY
      for (let i = 0; i < MAX_HISTORY + 5; i++) {
        snapshotBeforeStroke();
      }

      // After MAX_HISTORY+5 snapshots, we should be able to undo MAX_HISTORY times
      let undoCount = 0;
      while (canUndo()) {
        undo();
        undoCount++;
      }
      expect(undoCount).toBe(MAX_HISTORY);
    });
  });

  describe('undo', () => {
    it('pops from undo stack and pushes to redo stack', () => {
      const data = mockImageData(1);
      mockClone.mockReturnValue(data);
      snapshotBeforeStroke();

      mockClone.mockReturnValue(mockImageData(2));
      undo();

      expect(mockRestore).toHaveBeenCalledWith(data);
      expect(canUndo()).toBe(false);
      expect(canRedo()).toBe(true);
    });

    it('does nothing when undo stack is empty', () => {
      undo();
      expect(mockRestore).not.toHaveBeenCalled();
      expect(canUndo()).toBe(false);
      expect(canRedo()).toBe(false);
    });
  });

  describe('redo', () => {
    it('pops from redo stack and pushes to undo stack', () => {
      mockClone.mockReturnValue(mockImageData(1));
      snapshotBeforeStroke();

      mockClone.mockReturnValue(mockImageData(2));
      undo();

      mockClone.mockReturnValue(mockImageData(3));
      redo();

      expect(mockRestore).toHaveBeenCalledWith(mockImageData(2));
      expect(canUndo()).toBe(true);
      expect(canRedo()).toBe(false);
    });

    it('does nothing when redo stack is empty', () => {
      redo();
      expect(mockRestore).not.toHaveBeenCalled();
      expect(canUndo()).toBe(false);
      expect(canRedo()).toBe(false);
    });
  });

  describe('canUndo / canRedo', () => {
    it('returns false after reset', () => {
      expect(canUndo()).toBe(false);
      expect(canRedo()).toBe(false);
    });

    it('returns true for canUndo after snapshot', () => {
      mockClone.mockReturnValue(mockImageData(1));
      snapshotBeforeStroke();
      expect(canUndo()).toBe(true);
      expect(canRedo()).toBe(false);
    });
  });
});
