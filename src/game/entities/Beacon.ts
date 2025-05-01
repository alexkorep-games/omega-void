import { GameObject } from "./GameObject";
import { IBeacon } from "../types";

export const BEACON_SIZE = 12;
export const BEACON_COLOR = "#FFFF00"; // Yellow
export const BEACON_ACTIVATED_COLOR = "#FFA500"; // Orange

export class Beacon extends GameObject implements IBeacon {
  type: "beacon";
  isActive: boolean;

  constructor(x: number, y: number, idSuffix: string | number) {
    // Use BEACON_SIZE for both size and radius for simplicity in collision/rendering
    super(x, y, BEACON_SIZE, BEACON_COLOR, `beacon_${idSuffix}`);
    this.type = "beacon";
    this.isActive = false; // Starts inactive
  }

  update(): void {
    // Beacons are static, no update logic needed for movement etc.
  }

  // Method to change state, called by WorldManager or logic
  activate(): void {
    if (!this.isActive) {
      this.isActive = true;
      this.color = BEACON_ACTIVATED_COLOR; // Change color on activation
      console.log(`Beacon ${this.id} activated.`);
    }
  }

  // Optional: Method to reset state if needed
  deactivate(): void {
    if (this.isActive) {
      this.isActive = false;
      this.color = BEACON_COLOR;
      console.log(`Beacon ${this.id} deactivated.`);
    }
  }
}
