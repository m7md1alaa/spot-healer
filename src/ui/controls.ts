import { BrushEngine } from "../engine/brush";
import { textureFill } from "../engine/fillStrategies/textureFill";
import { commitWorking, getState } from "../engine/canvas";
import { downloadImage } from "../engine/export";
import * as history from "../engine/history";
import { handleFileUpload } from "../engine/upload";
import { initKeybindings } from "./keybindings";
import { formatForDisplay, detectPlatform } from "@tanstack/hotkeys";

const MIN_RADIUS = 5;
const MAX_RADIUS = 60;
const DEFAULT_RADIUS = 20;
const HARDNESS = 0.5;

export function initControls(): void {
  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  const originalCanvas = document.getElementById(
    "canvas-original",
  ) as HTMLCanvasElement;
  const workingCanvas = document.getElementById(
    "canvas-working",
  ) as HTMLCanvasElement;
  const wrapper = document.getElementById("canvas-wrapper") as HTMLDivElement;
  const emptyState = document.getElementById(
    "empty-state",
  ) as HTMLElement;

  const brushSizeInput = document.getElementById(
    "brush-size",
  ) as HTMLInputElement;
  const brushSizeValue = document.getElementById(
    "brush-size-value",
  ) as HTMLSpanElement;
  const undoBtn = document.getElementById("undo-btn") as HTMLButtonElement;
  const redoBtn = document.getElementById("redo-btn") as HTMLButtonElement;
  const compareBtn = document.getElementById(
    "compare-btn",
  ) as HTMLButtonElement;
  const downloadBtn = document.getElementById(
    "download-btn",
  ) as HTMLButtonElement;
  const cursor = document.getElementById("brush-cursor") as HTMLDivElement;

  let radius = DEFAULT_RADIUS;

  const brush = new BrushEngine(workingCanvas, textureFill, {
    radius,
    hardness: HARDNESS,
  });
  brush.onStrokeEnd = refreshHistoryButtons;

  // --- Brush size slider ---
  brushSizeInput.min = String(MIN_RADIUS);
  brushSizeInput.max = String(MAX_RADIUS);
  brushSizeInput.value = String(DEFAULT_RADIUS);
  brushSizeValue.textContent = String(DEFAULT_RADIUS);

  brushSizeInput.addEventListener("input", () => {
    radius = Number(brushSizeInput.value);
    brushSizeValue.textContent = String(radius);
    brush.setRadius(radius);
    updateCursorSize();
  });

  // --- Brush cursor: follows pointer, sized to match brush radius ---
  function updateCursorSize(): void {
    const state = getState();
    if (!state) return;
    const rect = workingCanvas.getBoundingClientRect();
    const scale = rect.width / state.width;
    const diameter = radius * 2 * scale;
    cursor.style.width = `${diameter}px`;
    cursor.style.height = `${diameter}px`;
  }

  wrapper.addEventListener("pointermove", (e) => {
    if (!getState()) return;
    const rect = wrapper.getBoundingClientRect();
    cursor.style.left = `${e.clientX - rect.left}px`;
    cursor.style.top = `${e.clientY - rect.top}px`;
    cursor.style.opacity = "1";
    updateCursorSize();
  });

  wrapper.addEventListener("pointerleave", () => {
    cursor.style.opacity = "0";
  });

  // --- Upload ---
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const { width, height } = await handleFileUpload(
      file,
      originalCanvas,
      workingCanvas,
    );
    wrapper.style.aspectRatio = `${width} / ${height}`;
    emptyState.hidden = true;

    compareBtn.disabled = false;
    downloadBtn.disabled = false;
    refreshHistoryButtons();

    fileInput.value = "";
  });

  // --- Undo / redo ---
  function refreshHistoryButtons(): void {
    undoBtn.disabled = !history.canUndo();
    redoBtn.disabled = !history.canRedo();
  }

  undoBtn.addEventListener("click", () => {
    history.undo();
    refreshHistoryButtons();
  });

  redoBtn.addEventListener("click", () => {
    history.redo();
    refreshHistoryButtons();
  });

  // --- Before / after (hold to compare original) ---
  const showOriginal = (e: Event): void => {
    e.preventDefault();
    workingCanvas.style.opacity = "0";
  };
  const showWorking = (e: Event): void => {
    e.preventDefault();
    workingCanvas.style.opacity = "1";
  };

  compareBtn.addEventListener("pointerdown", showOriginal);
  compareBtn.addEventListener("pointerup", showWorking);
  compareBtn.addEventListener("pointerleave", showWorking);

  // --- Download ---
  downloadBtn.addEventListener("click", () => {
    commitWorking();
    downloadImage();
  });

  // --- Keyboard shortcuts ---
  initKeybindings({
    undo: () => {
      history.undo();
      refreshHistoryButtons();
    },
    redo: () => {
      history.redo();
      refreshHistoryButtons();
    },
    decreaseBrushSize: () => {
      radius = Math.max(MIN_RADIUS, radius - 5);
      brush.setRadius(radius);
      brushSizeInput.value = String(radius);
      brushSizeValue.textContent = String(radius);
      updateCursorSize();
    },
    increaseBrushSize: () => {
      radius = Math.min(MAX_RADIUS, radius + 5);
      brush.setRadius(radius);
      brushSizeInput.value = String(radius);
      brushSizeValue.textContent = String(radius);
      updateCursorSize();
    },
  });

  // --- Keyboard shortcut guide ---
  const guide = document.getElementById("kbd-guide");
  if (guide) {
    const platform = detectPlatform();
    const fmt = (h: string) => formatForDisplay(h, { platform });

    const groups = [{ keys: ["[", "]"] }, { keys: ["Mod+Z", "Mod+Shift+Z"] }];

    for (const { keys } of groups) {
      const hint = document.createElement("span");
      hint.className = "kbd-hint";
      for (const key of keys) {
        const kbd = document.createElement("kbd");
        kbd.textContent = fmt(key);
        hint.appendChild(kbd);
      }
      guide.appendChild(hint);
    }
  }
}
