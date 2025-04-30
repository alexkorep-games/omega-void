// src/game/entities/Player.ts
import { GameObject } from "./GameObject";
import { IPlayer, ITouchState } from "../types";
import {
  PLAYER_SIZE,
  PLAYER_COLOR,
  PLAYER_SPEED,
  TOUCH_MOVE_MAX_DIST,
  DEFAULT_STARTING_SHIELD,
} from "../config";

export class Player extends GameObject implements IPlayer {
  angle: number;
  vx: number;
  vy: number;
  shieldLevel: number; // Add shield level
  maxShield: number; // Add max shield capacity

  constructor(x: number, y: number) {
    super(x, y, PLAYER_SIZE, PLAYER_COLOR, "player");
    this.shieldLevel = DEFAULT_STARTING_SHIELD; // Initialize shields
    this.maxShield = DEFAULT_STARTING_SHIELD; // Initialize max shield
    this.angle = -Math.PI / 2; // Pointing up
    this.vx = 0;
    this.vy = 0;
  }

  // Update player based on touch input and engine boost level
  update(touchState: ITouchState, engineBoosterLevel: number): void {
    // Calculate speed multiplier based on engine booster level
    const speedMultiplier = 1 + engineBoosterLevel * 0.2; // +20% speed per level
    const currentSpeed = PLAYER_SPEED * speedMultiplier;

    if (touchState.move.active) {
      const dx = touchState.move.currentX - touchState.move.startX;
      const dy = touchState.move.currentY - touchState.move.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        // Normalize the movement vector and scale by speed, clamping distance effect
        const moveMagnitude =
          Math.min(dist, TOUCH_MOVE_MAX_DIST) / TOUCH_MOVE_MAX_DIST;
        const moveAngle = Math.atan2(dy, dx);
        this.vx = Math.cos(moveAngle) * currentSpeed * moveMagnitude;
        this.vy = Math.sin(moveAngle) * currentSpeed * moveMagnitude;
        // Only update visual angle if moving significantly
        if (moveMagnitude > 0.1) {
          this.angle = moveAngle;
        }
      } else {
        this.vx = 0;
        this.vy = 0;
      }
    } else {
      this.vx = 0;
      this.vy = 0;
    }

    this.x += this.vx;
    this.y += this.vy;
  }
}
