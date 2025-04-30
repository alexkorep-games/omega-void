import { describe, test, expect } from "vitest";
import { Enemy } from "./Enemy";

describe("Enemy", () => {
  test("should initialize with correct properties", () => {
    const enemy = new Enemy(10, 20, 5);
    expect(enemy.x).toBe(10);
    expect(enemy.y).toBe(20);
    expect(enemy.radius).toBe(9);
  });

  test("should update position correctly", () => {
    const enemy = new Enemy(10, 20, 5);
    const mockPlayer = { x: 100, y: 100, radius: 5, angle: 0, vx: 0, vy: 0, shieldLevel: 100, id: "player_1", size: 10, color: "blue" };
    enemy.update(mockPlayer);
    expect(enemy.x).not.toBe(10); // Ensure position changes
    expect(enemy.y).not.toBe(20);
  });
});