import { GameObject } from "./GameObject";
import { IAsteroid } from "../types"; // Import the interface

export class Asteroid extends GameObject implements IAsteroid {
  type: "asteroid"; // Type of the object
  spin: number; // radians per frame
  angle: number; // Visual rotation angle, separate from orbit angle
  orbitCenterX: number; // Store the center of the orbit
  orbitCenterY: number; // Store the center of the orbit
  initialOrbitAngle: number; // Initial angle of the orbit
  orbitRadius: number; // Radius of the orbit
  orbitSpeed: number; // Speed of the orbit

  constructor(
    cx: number, // Center X of the orbit
    cy: number, // Center Y of the orbit
    initialOrbitAngle: number, // Initial position angle on the orbit
    orbitRadius: number, // The radius of the orbit
    size: number, // Diameter of the asteroid
    groupOrbitalSpeed: number = 0 // Speed of the orbit
  ) {
    const initialX = cx + Math.cos(initialOrbitAngle) * orbitRadius;
    const initialY = cy + Math.sin(initialOrbitAngle) * orbitRadius;

    const color = "#888"
    super(initialX, initialY, size, color, "asteroid");

    this.type = "asteroid"; // Set the type for the object
    this.orbitCenterX = cx;
    this.orbitCenterY = cy;
    this.initialOrbitAngle = initialOrbitAngle;
    this.orbitRadius = orbitRadius;

    this.orbitSpeed = groupOrbitalSpeed + orbitRadius * 0.001; // Speed of the orbit

    this.spin = (Math.random() - 0.5) * 5;
    this.angle = Math.random() * Math.PI * 2;
  }

  update(currentTimeSeconds: number): void {
    const orbitAngle = this.initialOrbitAngle + this.orbitSpeed * currentTimeSeconds;

    this.x = this.orbitCenterX + Math.cos(orbitAngle) * this.orbitRadius;
    this.y = this.orbitCenterY + Math.sin(orbitAngle) * this.orbitRadius;

    this.angle = this.spin * currentTimeSeconds;
    this.angle %= Math.PI * 2;
  }
}
