// src/utils/storage.ts
import { DEFAULT_STARTING_CASH } from "../game/config";
import { IPosition, CargoHold, QuestInventory } from "../game/types"; // Import Record types
import { QuestState, initialQuestState } from "../quests/QuestState";

const SAVE_KEY = "omegaVoidSaveData_v0.1"; // Update version if save format changes significantly

// Define the structure of the saved data, aligning with IGameState changes
export interface SaveData {
  coordinates: IPosition;
  cash: number;
  cargoHold: CargoHold; // Use Record type alias: Record<string, number>
  lastDockedStationId: string | null;
  discoveredStations: string[];
  // Store known prices as Record<stationId, Record<commodityId, price>>
  knownStationPrices: Record<string, Record<string, number>>;
  // Upgrade levels
  cargoPodLevel: number;
  shieldCapacitorLevel: number;
  engineBoosterLevel: number;
  hasAutoloader: boolean;
  hasNavComputer: boolean;
  // Quest data
  questState: QuestState;
  questInventory: QuestInventory; // Use Record type alias: Record<string, number>
}

// --- Save Game State ---
export function saveGameState(data: SaveData): void {
  try {
    // Data should already be in the correct Record format
    const jsonString = JSON.stringify(data);
    localStorage.setItem(SAVE_KEY, jsonString);
    // console.log("Game state saved."); // Reduce console noise
  } catch (error) {
    console.error("Error saving game state:", error);
  }
}

// --- Load Game State ---
export function loadGameState(): SaveData {
  try {
    const jsonString = localStorage.getItem(SAVE_KEY);
    if (jsonString) {
      const loadedData = JSON.parse(jsonString) as SaveData; // Assume structure matches SaveData

      // --- Validation and Defaults ---
      // Basic validation for coordinates
      const coordinates =
        loadedData.coordinates &&
        typeof loadedData.coordinates.x === "number" &&
        typeof loadedData.coordinates.y === "number"
          ? loadedData.coordinates
          : { x: 0, y: 0 };

      // Validate cash
      const cash =
        typeof loadedData.cash === "number" && !isNaN(loadedData.cash)
          ? loadedData.cash
          : DEFAULT_STARTING_CASH;

      // Validate cargoHold (ensure it's an object)
      const cargoHold =
        loadedData.cargoHold && typeof loadedData.cargoHold === "object"
          ? loadedData.cargoHold
          : {};

      // Validate lastDockedStationId
      const lastDockedStationId =
        typeof loadedData.lastDockedStationId === "string" ||
        loadedData.lastDockedStationId === null
          ? loadedData.lastDockedStationId
          : null;

      // Validate discoveredStations (ensure it's an array of strings)
      const discoveredStations =
        Array.isArray(loadedData.discoveredStations) &&
        loadedData.discoveredStations.every((s) => typeof s === "string")
          ? loadedData.discoveredStations
          : [];

      // Validate knownStationPrices (ensure it's an object where values are objects)
      const knownStationPrices =
        loadedData.knownStationPrices &&
        typeof loadedData.knownStationPrices === "object" &&
        Object.values(loadedData.knownStationPrices).every(
          (v) => typeof v === "object" && v !== null
        )
          ? loadedData.knownStationPrices
          : {};

      // Validate upgrade levels
      const cargoPodLevel = loadedData.cargoPodLevel || 0;
      const shieldCapacitorLevel = loadedData.shieldCapacitorLevel || 0;
      const engineBoosterLevel = loadedData.engineBoosterLevel || 0;
      const hasAutoloader = !!loadedData.hasAutoloader;
      const hasNavComputer = !!loadedData.hasNavComputer;

      // Validate quest state
      const questState =
        loadedData.questState &&
        typeof loadedData.questState.quests === "object"
          ? loadedData.questState
          : initialQuestState;

      // Validate quest inventory
      const questInventory =
        loadedData.questInventory &&
        typeof loadedData.questInventory === "object"
          ? loadedData.questInventory
          : {};

      console.log("Game state loaded and validated.");
      return {
        coordinates,
        cash,
        cargoHold,
        lastDockedStationId,
        discoveredStations,
        knownStationPrices,
        cargoPodLevel,
        shieldCapacitorLevel,
        engineBoosterLevel,
        hasAutoloader,
        hasNavComputer,
        questState,
        questInventory,
      };
    }
  } catch (error) {
    console.error("Error loading or parsing game state:", error);
  }

  // Return default values if loading fails or no save exists
  console.log("No valid save data found, returning defaults.");
  return {
    coordinates: { x: 0, y: 0 },
    cash: DEFAULT_STARTING_CASH,
    cargoHold: {},
    lastDockedStationId: null,
    discoveredStations: [],
    knownStationPrices: {},
    cargoPodLevel: 0,
    shieldCapacitorLevel: 0,
    engineBoosterLevel: 0,
    hasAutoloader: false,
    hasNavComputer: false,
    questState: initialQuestState,
    questInventory: {},
  };
}

// --- Clear Save Data ---
export function clearSaveData(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    console.log("Save data cleared.");
  } catch (error) {
    console.error("Error clearing save data:", error);
  }
}
