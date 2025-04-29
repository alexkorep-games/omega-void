// src/game/entities/Enemy.ts
import { GameObject } from "./GameObject";
import { IEnemy, IPlayer } from "../types";
import { ENEMY_SIZE, ENEMY_COLOR, ENEMY_SPEED } from "../config";

export class Enemy extends GameObject implements IEnemy {
  angle: number; // Facing direction

  constructor(x: number, y: number, idSuffix: number | string) {
    // Pass a unique suffix for deterministic ID generation if needed, otherwise rely on base counter
    super(x, y, ENEMY_SIZE, ENEMY_COLOR, `enemy_${idSuffix}`);
    this.angle = Math.random() * Math.PI * 2; // Initial random facing
  }

  update(player: IPlayer): void {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);

    // Only move if player is not too close (prevents jittering on top)
    if (distToPlayer > this.radius + player.radius - 5) {
      this.angle = Math.atan2(dy, dx); // Face the player
      this.x += Math.cos(this.angle) * ENEMY_SPEED;
      this.y += Math.sin(this.angle) * ENEMY_SPEED;
    }
    // Optional: Add slight random movement or evasion later?
  }
}
