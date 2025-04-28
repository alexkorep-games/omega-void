// src/components/drawing/GraphicsUtils.ts
import * as PIXI from "pixi.js";

// Helper to clear and set common line style
export function clearAndSetLineStyle(
  g: PIXI.Graphics,
  width: number,
  color: number,
  alpha: number = 1
) {
  g.clear();
  g.lineStyle(width, color, alpha);
}

// Helper to clear and set fill style
export function clearAndSetFillStyle(
  g: PIXI.Graphics,
  color: number,
  alpha: number = 1
) {
  g.clear();
  g.beginFill(color, alpha);
}
