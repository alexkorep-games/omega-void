// src/utils/storage.ts
import { LOCAL_STORAGE_GAME_STATE_KEY } from "../game/config";
import { IPosition } from "../game/types";

// Define the structure of the saved state
interface SavedGameState {
  coordinates: IPosition;
  cash: number;
  cargoHold: [string, number][]; // Store Map as array of [key, value] pairs
}

// Define the structure of the loaded state (including defaults)
interface LoadedGameState {
  coordinates: IPosition;
  cash: number;
  cargoHold: Map<string, number>;
}

/**
 * Saves the relevant player game state to local storage.
 * @param stateToSave - An object containing coordinates, cash, and cargoHold Map.
 */
export function saveGameState(stateToSave: {
  coordinates: IPosition;
  cash: number;
  cargoHold: Map<string, number>;
}): void {
  try {
    // Convert Map to array for JSON serialization
    const cargoArray = Array.from(stateToSave.cargoHold.entries());
    const saveData: SavedGameState = {
      coordinates: stateToSave.coordinates,
      cash: stateToSave.cash,
      cargoHold: cargoArray,
    };
    localStorage.setItem(
      LOCAL_STORAGE_GAME_STATE_KEY,
      JSON.stringify(saveData)
    );
    // console.log('Game state saved:', saveData); // Optional debug log
  } catch (error) {
    console.error("Failed to save game state:", error);
  }
}

/**
 * Loads the player's game state from local storage.
 * @returns The loaded state with coordinates, cash, and cargoHold Map, or defaults if not found/invalid.
 */
export function loadGameState(): LoadedGameState {
  const defaultState: LoadedGameState = {
    coordinates: { x: 0, y: 0 },
    cash: 1000.0, // Default starting cash
    cargoHold: new Map<string, number>(), // Default empty cargo
  };

  try {
    const savedStateString = localStorage.getItem(LOCAL_STORAGE_GAME_STATE_KEY);
    if (savedStateString) {
      const parsedData = JSON.parse(
        savedStateString
      ) as Partial<SavedGameState>;

      // --- Validate loaded data ---
      const loadedCoordinates =
        parsedData.coordinates &&
        typeof parsedData.coordinates.x === "number" &&
        typeof parsedData.coordinates.y === "number"
          ? parsedData.coordinates
          : defaultState.coordinates;

      const loadedCash =
        typeof parsedData.cash === "number"
          ? parsedData.cash
          : defaultState.cash;

      let loadedCargoHold = defaultState.cargoHold;
      if (
        Array.isArray(parsedData.cargoHold) &&
        parsedData.cargoHold.every(
          (item) =>
            Array.isArray(item) &&
            item.length === 2 &&
            typeof item[0] === "string" &&
            typeof item[1] === "number"
        )
      ) {
        // Reconstruct Map from the array
        loadedCargoHold = new Map(parsedData.cargoHold);
      } else if (parsedData.cargoHold !== undefined) {
        // Log a warning if cargoHold exists but is invalid format
        console.warn(
          "Invalid cargoHold format in localStorage. Using default empty cargo hold."
        );
      }

      console.log(
        `Loaded game state: Coords=(${loadedCoordinates.x},${loadedCoordinates.y}), Cash=${loadedCash}, Cargo=${loadedCargoHold.size} items`
      );

      return {
        coordinates: loadedCoordinates,
        cash: loadedCash,
        cargoHold: loadedCargoHold,
      };
    } else {
      console.log("No saved game state found. Starting with default state.");
    }
  } catch (error) {
    console.error("Error loading or parsing saved game state:", error);
    // Fallback to default if there's an error
  }
  return defaultState;
}
