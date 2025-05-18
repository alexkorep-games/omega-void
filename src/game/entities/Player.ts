// src/game/entities/Player.ts
import { GameObject } from "./GameObject";
import { IPlayer, ITouchState } from "../types";
import {
  PLAYER_SIZE,
  PLAYER_COLOR,
  PLAYER_SPEED, // This is likely units per second now
  TOUCH_JOYSTICK_OUTER_RADIUS,
  DEFAULT_STARTING_SHIELD,
} from "../config";

// Constants for new control scheme
const MAX_ROTATION_SPEED_RAD_PER_SEC = Math.PI * 1.5; // Max radians per second rotation
const ROTATION_INPUT_SCALE_FACTOR = 1.2; // Adjusts sensitivity of swipe X to rotation speed
const THRUST_INPUT_SCALE_FACTOR = 1.0; // Adjusts sensitivity of swipe Y to thrust percentage

// Consider if PLAYER_SPEED needs to be adjusted. If it was units/frame before, it might need to be scaled up.
// For now, we assume PLAYER_SPEED is units/second.
// Example: If old speed was 2.5 units/frame @60fps, new PLAYER_SPEED could be 2.5 * 60 = 150 units/second.
// Let's use a potentially higher speed for testing.
const EFFECTIVE_PLAYER_SPEED = 100; // Or keep PLAYER_SPEED and adjust its value in config.ts

export class Player extends GameObject implements IPlayer {
  angle: number;
  vx: number; // Velocity component (units per second)
  vy: number; // Velocity component (units per second)
  shieldLevel: number;
  maxShield: number;

  constructor(x: number, y: number) {
    super(x, y, PLAYER_SIZE, PLAYER_COLOR, "player");
    this.shieldLevel = DEFAULT_STARTING_SHIELD;
    this.maxShield = DEFAULT_STARTING_SHIELD;
    this.angle = -Math.PI / 2; // Initial: Pointing up in world space (0 radians is right)
    this.vx = 0;
    this.vy = 0;
  }

  update(
    touchState: ITouchState | undefined,
    engineBoosterLevel: number,
    deltaTime: number // deltaTime in milliseconds
  ): void {
    const dtSeconds = deltaTime / 1000.0;

    if (touchState && touchState.move.active) {
      const dx = touchState.move.currentX - touchState.move.startX; // Corrected typo
      const dy = touchState.move.currentY - touchState.move.startY;

      // --- Rotation ---
      const rotationInputNormalized = Math.max(
        -1,
        Math.min(
          1,
          dx / (TOUCH_JOYSTICK_OUTER_RADIUS * ROTATION_INPUT_SCALE_FACTOR)
        )
      );
      const angularVelocity =
        rotationInputNormalized * MAX_ROTATION_SPEED_RAD_PER_SEC;
      this.angle += angularVelocity * dtSeconds;
      this.angle = (this.angle + 2 * Math.PI) % (2 * Math.PI); // Normalize angle

      // --- Thrust ---
      const thrustInputNormalized = Math.max(
        -1,
        Math.min(
          1,
          -dy / (TOUCH_JOYSTICK_OUTER_RADIUS * THRUST_INPUT_SCALE_FACTOR)
        )
      );

      const currentBaseSpeed = PLAYER_SPEED * (1 + engineBoosterLevel * 0.2); // Using PLAYER_SPEED from config
      // const currentBaseSpeed = EFFECTIVE_PLAYER_SPEED * (1 + engineBoosterLevel * 0.2); // Alternative if testing higher speed

      const effectiveSpeed = currentBaseSpeed * thrustInputNormalized; // This is now units per second

      this.vx = Math.cos(this.angle) * effectiveSpeed;
      this.vy = Math.sin(this.angle) * effectiveSpeed;
    } else {
      this.vx = 0;
      this.vy = 0;
    }

    this.x += this.vx * dtSeconds;
    this.y += this.vy * dtSeconds;
  }
}
