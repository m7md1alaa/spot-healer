import { getStrokePoints } from 'perfect-freehand';
import { commitWorking, getState } from './canvas';
import { snapshotBeforeStroke } from './history';
import type { FillStrategy } from './fillStrategies/types';

export interface BrushOptions {
  /** Brush radius, in image pixels. */
  radius: number;
  /** 0 = fully soft edge, 1 = hard edge. */
  hardness: number;
}

type RawPoint = [x: number, y: number, pressure: number];

/**
 * Handles pointer input on the working canvas and turns it into a series
 * of "stamps" applied via the active `FillStrategy`.
 *
 * The fill strategy is fully swappable at runtime via `setFillStrategy` —
 * this class never assumes which algorithm (blur, clone, etc.) is active.
 */
export class BrushEngine {
  private canvas: HTMLCanvasElement;
  private fillStrategy: FillStrategy;
  private options: BrushOptions;

  private rawPoints: RawPoint[] = [];
  private processedCount = 0;
  private lastStampPos: { x: number; y: number } | null = null;
  private drawing = false;
  private rafId: number | null = null;

  /** Called once per stroke, after the canvas has been updated. */
  public onStrokeEnd: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, fillStrategy: FillStrategy, options: BrushOptions) {
    this.canvas = canvas;
    this.fillStrategy = fillStrategy;
    this.options = options;

    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  setFillStrategy(strategy: FillStrategy): void {
    this.fillStrategy = strategy;
  }

  setRadius(radius: number): void {
    this.options.radius = radius;
  }

  /** Converts a pointer event to image-pixel coordinates (canvas may be CSS-scaled). */
  private toCanvasPoint(e: PointerEvent): RawPoint {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    return [x, y, pressure];
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!getState()) return;
    e.preventDefault();

    this.drawing = true;
    this.rawPoints = [this.toCanvasPoint(e)];
    this.processedCount = 1;
    this.lastStampPos = { x: this.rawPoints[0][0], y: this.rawPoints[0][1] };

    snapshotBeforeStroke();
    this.stampAt(this.rawPoints[0]);
    commitWorking();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.drawing || !getState()) return;
    this.rawPoints.push(this.toCanvasPoint(e));

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.processQueuedPoints);
    }
  };

  private onPointerUp = (): void => {
    if (!this.drawing) return;
    this.drawing = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.processQueuedPoints();
    this.onStrokeEnd?.();
  };

  /**
   * Runs at most once per animation frame. Smooths the raw pointer points
   * with Perfect Freehand, then stamps any new points that are far enough
   * from the last stamp to avoid redundant work.
   */
  private processQueuedPoints = (): void => {
    this.rafId = null;
    if (this.rawPoints.length < 2) return;

    const smoothed = getStrokePoints(this.rawPoints, {
      size: this.options.radius,
      streamline: 0.4,
    });

    const minSpacing = Math.max(2, this.options.radius * 0.35);

    for (let i = this.processedCount; i < smoothed.length; i++) {
      const [x, y] = smoothed[i].point;

      if (this.lastStampPos) {
        const dx = x - this.lastStampPos.x;
        const dy = y - this.lastStampPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < minSpacing) continue;
      }

      this.stampAt([x, y, 1]);
      this.lastStampPos = { x, y };
    }

    this.processedCount = smoothed.length;
    commitWorking();
  };

  private stampAt(point: RawPoint): void {
    const state = getState();
    if (!state) return;

    const [x, y] = point;
    this.fillStrategy(
      { original: state.original, working: state.working, width: state.width, height: state.height },
      { x, y, radius: this.options.radius, hardness: this.options.hardness }
    );
  }
}
