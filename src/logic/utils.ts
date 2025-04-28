// src/logic/utils.ts
import type { Point } from '../types';

export function distance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function distanceSq(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
}

// Function to load player coordinates
export function loadPlayerPosition(storageKey: string): Point {
    let startX = 0;
    let startY = 0;
    try {
      const savedCoordsString = localStorage.getItem(storageKey);
      if (savedCoordsString) {
        const savedCoords = JSON.parse(savedCoordsString) as Partial<Point>;
        if (typeof savedCoords.x === "number" && typeof savedCoords.y === "number") {
          startX = savedCoords.x;
          startY = savedCoords.y;
          console.log(`Loaded saved position: X=${startX}, Y=${startY}`);
        } else {
          console.warn("Invalid coordinate format in localStorage. Using default position.");
        }
      } else {
        console.log("No saved position found. Starting at default position.");
      }
    } catch (error) {
      console.error("Error loading or parsing saved position:", error);
    }
    return { x: startX, y: startY };
}

// Function to save player coordinates
export function savePlayerPosition(storageKey: string, coords: Point): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(coords));
      // console.log('Player position saved:', coords); // Optional debug log
    } catch (error) {
      console.error("Failed to save player position:", error);
    }
}