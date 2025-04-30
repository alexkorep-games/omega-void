import { describe, test, expect } from "vitest";
import { Enemy } from "./Enemy";
import { ENEMY_SPEED } from "../config";

describe("GameObject", () => {
  test("should initialize with correct properties", () => {
    const obj = new Enemy(0, 0, 1);
    expect(obj.x).toBe(0);
    expect(obj.y).toBe(0);
  });

  test("should move correctly", () => {
    const obj = new Enemy(0, 0, 1);
    // Ensure player is far enough for movement
    obj.update({
      x: 100,
      y: 100,
      radius: 5,
      angle: 0,
      vx: 0,
      vy: 0,
      shieldLevel: 100,
      id: "player_1",
      size: 10,
      color: "blue",
      maxShield: 0,
    });
    // Adjust angle to match the calculated movement
    const angle = Math.atan2(100 - 0, 100 - 0);
    expect(obj.x).toBeCloseTo(0 + Math.cos(angle) * ENEMY_SPEED);
    expect(obj.y).toBeCloseTo(0 + Math.sin(angle) * ENEMY_SPEED);
  });
});
