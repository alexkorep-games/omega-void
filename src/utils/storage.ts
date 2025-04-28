// src/utils/storage.ts
import { LOCAL_STORAGE_COORDS_KEY } from "../game/config";
import { IPosition } from "../game/types";

/**
 * Saves the player's position to local storage.
 * @param position - The player's position { x, y }.
 */
export function savePlayerPosition(position: IPosition): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_COORDS_KEY, JSON.stringify(position));
    // console.log('Player position saved:', position); // Optional debug log
  } catch (error) {
    console.error("Failed to save player position:", error);
  }
}

/**
 * Loads the player's position from local storage.
 * @returns The loaded position { x, y } or the default { x: 0, y: 0 } if not found or invalid.
 */
export function loadPlayerPosition(): IPosition {
  let startX = 0;
  let startY = 0;
  try {
    const savedCoordsString = localStorage.getItem(LOCAL_STORAGE_COORDS_KEY);
    if (savedCoordsString) {
      const savedCoords = JSON.parse(savedCoordsString);
      // Basic validation
      if (
        typeof savedCoords.x === "number" &&
        typeof savedCoords.y === "number"
      ) {
        startX = savedCoords.x;
        startY = savedCoords.y;
        console.log(`Loaded saved position: X=${startX}, Y=${startY}`);
      } else {
        console.warn(
          "Invalid coordinate format in localStorage. Using default position."
        );
      }
    } else {
      console.log("No saved position found. Starting at default position.");
    }
  } catch (error) {
    console.error("Error loading or parsing saved position:", error);
    // Fallback to default if there's an error
  }
  return { x: startX, y: startY };
}
