// src/utils/storage.ts
import {
  DEFAULT_STARTING_CASH,
  LOCAL_STORAGE_GAME_STATE_KEY,
} from "../game/config";
import { IPosition } from "../game/types";

// Define the structure of the saved state
interface SavedGameState {
  coordinates: IPosition;
  cash: number;
  cargoHold: [string, number][]; // Map as array of [key, value] pairs
  lastDockedStationId: string | null;
  discoveredStations: string[]; // Added: Array of station IDs
  knownStationPrices: [string, [string, number][]][]; // Added: Map<stationId, Map<commodityKey, price>> serialized
  // shieldLevel?: number; // Optional: Save shield level if needed
}

// Define the structure of the loaded state (including defaults)
interface LoadedGameState {
  coordinates: IPosition;
  lastDockedStationId: string | null;
  cash: number;
  cargoHold: Map<string, number>;
  knownStationPrices: Map<string, Map<string, number>>; // Added
  discoveredStations: string[]; // Added: Array of station IDs
  // shieldLevel?: number; // Optional: Load shield level
}

/**
 * Saves the relevant player game state to local storage.
 * @param stateToSave - An object containing coordinates, cash, cargoHold Map, lastDockedStationId, and discoveredStations.
 */
export function saveGameState(stateToSave: {
  coordinates: IPosition;
  cash: number;
  lastDockedStationId: string | null;
  cargoHold: Map<string, number>;
  discoveredStations: string[]; // Added
  knownStationPrices: Map<string, Map<string, number>>; // Added
  // shieldLevel?: number; // Optional
}): void {
  try {
    // Convert Map to array for JSON serialization
    const cargoArray = Array.from(stateToSave.cargoHold.entries());
    // Convert nested Map to array for JSON serialization
    const pricesArray = Array.from(
      stateToSave.knownStationPrices.entries()
    ).map(([stationId, priceMap]) => {
      return [stationId, Array.from(priceMap.entries())] as [
        string,
        [string, number][]
      ];
    });
    const saveData: SavedGameState = {
      coordinates: stateToSave.coordinates,
      cash: stateToSave.cash,
      cargoHold: cargoArray,
      lastDockedStationId: stateToSave.lastDockedStationId,
      knownStationPrices: pricesArray, // Added
      discoveredStations: stateToSave.discoveredStations, // Added
      // shieldLevel: stateToSave.shieldLevel, // Optional
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
 * @returns The loaded state with coordinates, cash, cargoHold Map, lastDockedStationId, discoveredStations, or defaults if not found/invalid.
 */
export function loadGameState(): LoadedGameState {
  const defaultState: LoadedGameState = {
    coordinates: { x: 0, y: 0 },
    cash: DEFAULT_STARTING_CASH, // Default starting cash
    lastDockedStationId: null, // Default no last station
    cargoHold: new Map<string, number>(), // Default empty cargo
    discoveredStations: [], // Default empty discovered list
    knownStationPrices: new Map<string, Map<string, number>>(), // Default empty prices map
    // shieldLevel: DEFAULT_STARTING_SHIELD, // Default full shield if loading
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

      const loadedLastDockedId =
        typeof parsedData.lastDockedStationId === "string" ||
        parsedData.lastDockedStationId === null // Allow null
          ? parsedData.lastDockedStationId
          : defaultState.lastDockedStationId;

      // const loadedShieldLevel =
      //  typeof parsedData.shieldLevel === "number" && parsedData.shieldLevel >= 0 && parsedData.shieldLevel <= 100
      //    ? parsedData.shieldLevel
      //    : defaultState.shieldLevel;

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

      // Validate discoveredStations
      let loadedDiscoveredStations = defaultState.discoveredStations;
      if (
        Array.isArray(parsedData.discoveredStations) &&
        parsedData.discoveredStations.every((item) => typeof item === "string")
      ) {
        loadedDiscoveredStations = parsedData.discoveredStations;
      } else if (parsedData.discoveredStations !== undefined) {
        console.warn(
          "Invalid discoveredStations format in localStorage. Using default empty list."
        );
      }

      // Validate knownStationPrices
      let loadedKnownPrices = defaultState.knownStationPrices;
      if (
        Array.isArray(parsedData.knownStationPrices) &&
        parsedData.knownStationPrices.every(
          (stationEntry) =>
            Array.isArray(stationEntry) &&
            stationEntry.length === 2 &&
            typeof stationEntry[0] === "string" &&
            Array.isArray(stationEntry[1]) &&
            stationEntry[1].every(
              (priceEntry) =>
                Array.isArray(priceEntry) &&
                priceEntry.length === 2 &&
                typeof priceEntry[0] === "string" &&
                typeof priceEntry[1] === "number"
            )
        )
      ) {
        // Reconstruct Map<string, Map<string, number>>
        loadedKnownPrices = new Map(
          parsedData.knownStationPrices.map(([stationId, priceArray]) => [
            stationId,
            new Map(priceArray),
          ])
        );
      } else if (parsedData.knownStationPrices !== undefined) {
        console.warn(
          "Invalid knownStationPrices format in localStorage. Using default empty map."
        );
      }

      console.log(
        `Loaded game state: Coords=(${loadedCoordinates.x},${loadedCoordinates.y}), Cash=${loadedCash}, Cargo=${loadedCargoHold.size} items, LastDocked=${loadedLastDockedId}, Discovered=${loadedDiscoveredStations.length} stations, KnownPrices=${loadedKnownPrices.size} stations` // Added KnownPrices log
      );

      return {
        coordinates: loadedCoordinates,
        cash: loadedCash,
        lastDockedStationId: loadedLastDockedId, // Return loaded ID
        cargoHold: loadedCargoHold,
        discoveredStations: loadedDiscoveredStations, // Return loaded list
        knownStationPrices: loadedKnownPrices, // Return loaded prices map
        // shieldLevel: loadedShieldLevel, // Return loaded shield
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
