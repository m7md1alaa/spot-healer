import { HotkeyManager } from '@tanstack/hotkeys';

export interface KeybindingActions {
  undo: () => void;
  redo: () => void;
  decreaseBrushSize: () => void;
  increaseBrushSize: () => void;
}

export function initKeybindings(
  actions: KeybindingActions,
  platform?: 'mac' | 'windows' | 'linux',
): void {
  const manager = HotkeyManager.getInstance();

  manager.register('[', () => {
    actions.decreaseBrushSize();
  }, { platform });

  manager.register(']', () => {
    actions.increaseBrushSize();
  }, { platform });

  manager.register('Mod+Z', () => {
    actions.undo();
  }, { platform });

  manager.register('Mod+Shift+Z', () => {
    actions.redo();
  }, { platform });
}

export function destroyKeybindings(): void {
  HotkeyManager.resetInstance();
}
