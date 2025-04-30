import { describe, test, expect } from "vitest";
import { Projectile } from "./Projectile";
import { PROJECTILE_SPEED } from "../config";

describe("Projectile", () => {
  test("should initialize with correct properties", () => {
    const projectile = new Projectile(0, 0, Math.PI / 4);
    expect(projectile.vx).toBeCloseTo(Math.cos(Math.PI / 4) * PROJECTILE_SPEED);
    expect(projectile.vy).toBeCloseTo(Math.sin(Math.PI / 4) * PROJECTILE_SPEED);
  });

  test("should update position correctly", () => {
    const projectile = new Projectile(0, 0, Math.PI / 4);
    projectile.update();
    expect(projectile.x).toBeCloseTo(0 + Math.cos(Math.PI / 4) * PROJECTILE_SPEED);
    expect(projectile.y).toBeCloseTo(0 + Math.sin(Math.PI / 4) * PROJECTILE_SPEED);
  });
});