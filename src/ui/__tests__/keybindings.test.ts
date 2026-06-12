import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HotkeyManager } from '@tanstack/hotkeys';
import type { KeybindingActions } from '../keybindings';

const PLATFORM = 'mac';
const { initKeybindings } = await import('../keybindings');

function createMockActions(): KeybindingActions {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    decreaseBrushSize: vi.fn(),
    increaseBrushSize: vi.fn(),
  };
}

function dispatchKeyEvent(key: string, options: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean; code?: string } = {}): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      shiftKey: options.shiftKey ?? false,
      metaKey: options.metaKey ?? false,
      ctrlKey: options.ctrlKey ?? false,
      code: options.code ?? key,
    })
  );
}

describe('keybindings', () => {
  let actions: KeybindingActions;

  beforeEach(() => {
    HotkeyManager.resetInstance();
    actions = createMockActions();
  });

  afterEach(() => {
    HotkeyManager.resetInstance();
  });

  describe('brush size', () => {
    it('decreases brush size when [ is pressed', () => {
      initKeybindings(actions, PLATFORM);
      dispatchKeyEvent('[', { code: 'BracketLeft' });
      expect(actions.decreaseBrushSize).toHaveBeenCalledOnce();
    });

    it('increases brush size when ] is pressed', () => {
      initKeybindings(actions, PLATFORM);
      dispatchKeyEvent(']', { code: 'BracketRight' });
      expect(actions.increaseBrushSize).toHaveBeenCalledOnce();
    });

    it('does not change brush size when { (Shift+[) is pressed', () => {
      initKeybindings(actions, PLATFORM);
      dispatchKeyEvent('{', { shiftKey: true, code: 'BracketLeft' });
      expect(actions.decreaseBrushSize).not.toHaveBeenCalled();
      expect(actions.increaseBrushSize).not.toHaveBeenCalled();
    });
  });

  describe('undo / redo', () => {
    it('calls undo when Mod+Z is pressed', () => {
      initKeybindings(actions, PLATFORM);
      dispatchKeyEvent('z', { metaKey: true, code: 'KeyZ' });
      expect(actions.undo).toHaveBeenCalledOnce();
    });

    it('calls redo when Mod+Shift+Z is pressed', () => {
      initKeybindings(actions, PLATFORM);
      dispatchKeyEvent('Z', { metaKey: true, shiftKey: true, code: 'KeyZ' });
      expect(actions.redo).toHaveBeenCalledOnce();
    });

    it('does not call redo when Mod+Z is pressed without Shift', () => {
      initKeybindings(actions, PLATFORM);
      dispatchKeyEvent('z', { metaKey: true, code: 'KeyZ' });
      expect(actions.redo).not.toHaveBeenCalled();
    });
  });
});
