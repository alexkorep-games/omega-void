// src/game/entities/Player.ts
import { GameObject } from "./GameObject";
import { IPlayer, ITouchState } from "../types";
import {
  PLAYER_SIZE,
  PLAYER_COLOR,
  PLAYER_SPEED,
  TOUCH_JOYSTICK_OUTER_RADIUS, // Use this for scaling input
  DEFAULT_STARTING_SHIELD,
} from "../config";

// Constants for new control scheme
const MAX_ROTATION_SPEED_RAD_PER_SEC = Math.PI * 1.5; // Max radians per second rotation
const ROTATION_INPUT_SCALE_FACTOR = 1.2; // Adjusts sensitivity of swipe X to rotation speed
const THRUST_INPUT_SCALE_FACTOR = 1.0;   // Adjusts sensitivity of swipe Y to thrust percentage

export class Player extends GameObject implements IPlayer {
  angle: number;
  vx: number;
  vy: number;
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

  // Update player based on touch input, engine boost level, and deltaTime
  update(
    touchState: ITouchState | undefined,
    engineBoosterLevel: number,
    deltaTime: number // deltaTime in milliseconds
  ): void {
    const dtSeconds = deltaTime / 1000.0; // Convert deltaTime to seconds

    if (touchState && touchState.move.active) {
      const dx = touchState.move.currentX - touchState.move.startX;
      const dy = touchState.move.currentY - touchState.move.startY;

      // --- Rotation ---
      // Scale dx by joystick radius to get a -1 to 1 factor (approx)
      // Positive dx (slide right) means positive angular velocity (turn clockwise/right in typical math contexts)
      const rotationInputNormalized = Math.max(
        -1,
        Math.min(1, dx / (TOUCH_JOYSTICK_OUTER_RADIUS * ROTATION_INPUT_SCALE_FACTOR))
      );
      const angularVelocity =
        rotationInputNormalized * MAX_ROTATION_SPEED_RAD_PER_SEC;
      this.angle += angularVelocity * dtSeconds;
      this.angle = (this.angle + 2 * Math.PI) % (2 * Math.PI); // Normalize angle

      // --- Thrust ---
      // Scale dy by joystick radius, negative dy (slide up) is forward thrust
      const thrustInputNormalized = Math.max(
        -1,
        Math.min(1, -dy / (TOUCH_JOYSTICK_OUTER_RADIUS * THRUST_INPUT_SCALE_FACTOR))
      ); // Range -1 (reverse) to 1 (forward)

      const currentBaseSpeed = PLAYER_SPEED * (1 + engineBoosterLevel * 0.2);
      const effectiveSpeed = currentBaseSpeed * thrustInputNormalized;

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