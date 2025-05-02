// src/utils/storage.ts
import { DEFAULT_STARTING_CASH } from "../game/config";
import { IPosition } from "../game/types";
import { QuestState, initialQuestState } from "../quests/QuestState"; // Import QuestState and initialQuestState

const SAVE_KEY = "omegaVoidSaveData_v0.1"; // Update version if save format changes significantly

// Define the structure of the saved data
interface SaveData {
  coordinates: IPosition;
  cash: number;
  cargoHold: Record<string, number>; // Store Map as Record of key-value pairs
  lastDockedStationId: string | null;
  discoveredStations: string[];
  knownStationPrices: Record<string, Record<string, number>>;
  // Upgrade levels
  cargoPodLevel: number;
  shieldCapacitorLevel: number;
  engineBoosterLevel: number;
  hasAutoloader: boolean;
  hasNavComputer: boolean;
  // Quest data
  questState: QuestState;
  questInventory: Record<string, number>;
}

// --- Save Game State ---
export function saveGameState(data: SaveData): void {
  try {
    const saveData: SaveData = {
      ...data,
      cargoHold: data.cargoHold, // Already a Record
      knownStationPrices: data.knownStationPrices, // Already a Record
      questInventory: data.questInventory, // Already a Record
    };
    const jsonString = JSON.stringify(saveData);
    localStorage.setItem(SAVE_KEY, jsonString);
    // console.log("Game state saved."); // Reduce console noise
  } catch (error) {
    console.error("Error saving game state:", error);
  }
}

// --- Load Game State ---
// Update the return type of loadGameState to correctly reflect the structure
export function loadGameState(): SaveData {
  try {
    const jsonString = localStorage.getItem(SAVE_KEY);
    if (jsonString) {
      const loadedData: SaveData = JSON.parse(jsonString);

      // Validate loaded quest state structure (simple check)
      const validQuestState =
        loadedData.questState &&
        typeof loadedData.questState.quests === "object"
          ? loadedData.questState
          : initialQuestState; // Fallback to initial if invalid

      console.log("Game state loaded.");
      return {
        ...loadedData,
        questState: validQuestState, // Return validated or initial quest state
      };
    }
  } catch (error) {
    console.error("Error loading game state:", error);
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
