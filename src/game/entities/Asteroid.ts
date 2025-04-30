import { GameObject } from "./GameObject";
import { IAsteroid } from "../types"; // Import the interface

export class Asteroid extends GameObject implements IAsteroid {
  type: "asteroid"; // Type of the object
  spin: number; // radians per frame
  orbitR: number; // big radius – gives “straight line” illusion
  orbitAngle: number; // Current angle in the orbit
  orbitSpeed: number; // Angular speed in radians per frame
  angle: number; // Visual rotation angle, separate from orbit angle
  orbitCenterX: number; // Store the center of the orbit
  orbitCenterY: number; // Store the center of the orbit

  constructor(
    cx: number, // Center X of the orbit
    cy: number, // Center Y of the orbit
    initialOrbitAngle: number, // Initial position angle on the orbit
    orbitRadius: number, // The radius of the orbit
    size: number, // Diameter of the asteroid
    color = "#888" // Default color
  ) {
    const initialX = cx + Math.cos(initialOrbitAngle) * orbitRadius;
    const initialY = cy + Math.sin(initialOrbitAngle) * orbitRadius;

    super(initialX, initialY, size, color, "asteroid");

    this.type = "asteroid"; // Set the type for the object
    this.orbitCenterX = cx;
    this.orbitCenterY = cy;
    this.orbitR = orbitRadius;
    this.orbitAngle = initialOrbitAngle;

    this.spin = (Math.random() - 0.5) * 0.01;
    this.orbitSpeed = (Math.random() - 0.5) * 0.0004;
    this.angle = Math.random() * Math.PI * 2;
  }

  update(): void {
    this.orbitAngle += this.orbitSpeed;
    this.x = this.orbitCenterX + Math.cos(this.orbitAngle) * this.orbitR;
    this.y = this.orbitCenterY + Math.sin(this.orbitAngle) * this.orbitR;
    this.angle += this.spin;
    this.angle %= Math.PI * 2;
  }
}
