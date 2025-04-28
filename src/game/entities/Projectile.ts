// src/game/entities/Projectile.ts
import { GameObject } from "./GameObject";
import { IProjectile } from "../types";
import {
  PROJECTILE_SIZE,
  PROJECTILE_COLOR,
  PROJECTILE_SPEED,
  ENEMY_DESPAWN_RADIUS,
  PROJECTILE_DESPAWN_RADIUS_FACTOR,
} from "../config";

export class Projectile extends GameObject implements IProjectile {
  vx: number;
  vy: number;
  life: number;

  constructor(x: number, y: number, angle: number) {
    super(x, y, PROJECTILE_SIZE, PROJECTILE_COLOR, "proj");
    this.vx = Math.cos(angle) * PROJECTILE_SPEED;
    this.vy = Math.sin(angle) * PROJECTILE_SPEED;
    this.life = 150; // Frames to live
  }

  update(): void {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  isOutOfBounds(focusX: number, focusY: number): boolean {
    const despawnRadius =
      ENEMY_DESPAWN_RADIUS * PROJECTILE_DESPAWN_RADIUS_FACTOR; // Larger radius for projectiles
    const despawnRadiusSq = despawnRadius * despawnRadius;
    const dx = this.x - focusX;
    const dy = this.y - focusY;
    const distSq = dx * dx + dy * dy;
    return distSq > despawnRadiusSq || this.life <= 0;
  }
}
